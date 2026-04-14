use anchor_lang::prelude::*;
use crate::state::*;

// ============================================================================
// INIT USER SCORE
// Creates a new UserScore PDA for a wallet on first launch.
// Called once per unique wallet from the React Native app.
// ============================================================================

#[derive(Accounts)]
pub struct InitUserScore<'info> {
    /// The user who owns this score account (must sign)
    #[account(mut)]
    pub user: Signer<'info>,

    /// UserScore PDA — seeds: [USER_SCORE_SEED, user.key()]
    #[account(
        init,
        payer = user,
        space = 8 + UserScore::INIT_SPACE,
        seeds = [USER_SCORE_SEED, user.key().as_ref()],
        bump,
    )]
    pub user_score: Account<'info, UserScore>,

    /// Global stats account — updated to increment total_users
    #[account(
        mut,
        seeds = [GLOBAL_STATS_SEED],
        bump = global_stats.bump,
    )]
    pub global_stats: Account<'info, GlobalStats>,

    pub system_program: Program<'info, System>,
}

pub fn init_user_score_handler(ctx: Context<InitUserScore>) -> Result<()> {
    let score = &mut ctx.accounts.user_score;
    let global = &mut ctx.accounts.global_stats;
    let now = Clock::get()?.unix_timestamp;

    score.wallet = ctx.accounts.user.key();
    score.focus_minutes = 0;
    score.accuracy = 100; // start optimistic — first quiz hasn't happened yet
    score.current_streak = 0;
    score.longest_streak = 0;
    score.total_earned_skr = 0;
    score.last_updated = 0; // 0 = never submitted — rate limit skipped on first quiz
    score.karma_boost_until = 0;
    score.bump = ctx.bumps.user_score;

    global.total_users = global.total_users.saturating_add(1);

    msg!(
        "UserScore initialized for wallet {} (total users: {})",
        score.wallet,
        global.total_users
    );
    Ok(())
}

// ============================================================================
// SUBMIT SCORE
// Called from KnowledgeGate.tsx after every successful quiz pass.
// Updates accuracy (rolling average), streak, focus minutes.
// Emits QuizPassed event for on-chain attestation.
// ============================================================================

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    /// The user who passed the quiz (must sign — prevents spoofing)
    #[account(mut)]
    pub user: Signer<'info>,

    /// UserScore PDA for this wallet
    #[account(
        mut,
        seeds = [USER_SCORE_SEED, user.key().as_ref()],
        bump = user_score.bump,
        // PDA derivation already guarantees wallet match; explicit check for clarity
        constraint = user_score.wallet == user.key() @ ScoreRegistryError::UnauthorizedAuthority,
    )]
    pub user_score: Account<'info, UserScore>,

    /// Global stats — updated with focus minutes
    #[account(
        mut,
        seeds = [GLOBAL_STATS_SEED],
        bump = global_stats.bump,
    )]
    pub global_stats: Account<'info, GlobalStats>,
}

pub fn submit_score_handler(
    ctx: Context<SubmitScore>,
    focus_minutes: u32,
    accuracy: u32,             // 0–100 for this quiz attempt
    question_set_hash: [u8; 32],
    max_difficulty: u8,
) -> Result<()> {
    require!(accuracy <= 100, ScoreRegistryError::InvalidAccuracy);
    require!(focus_minutes > 0, ScoreRegistryError::InvalidFocusMinutes);

    let score = &mut ctx.accounts.user_score;
    let global = &mut ctx.accounts.global_stats;
    let now_sec = Clock::get()?.unix_timestamp;
    let now_ms = now_sec * 1000;

    // Rate limit: min 60s between submits — skip for fresh accounts (last_updated == 0)
    if score.last_updated > 0 {
        let elapsed_sec = now_sec.saturating_sub(score.last_updated / 1000);
        require!(elapsed_sec >= 60, ScoreRegistryError::UpdateTooFrequent);
    }

    // Rolling accuracy average (weights new reading equally with historical)
    score.accuracy = (score.accuracy.saturating_add(accuracy)) / 2;

    // Streak: increment. The TS client / native Warden handles break detection.
    score.current_streak = score.current_streak.saturating_add(1);
    if score.current_streak > score.longest_streak {
        score.longest_streak = score.current_streak;
    }

    // Focus minutes
    score.focus_minutes = score.focus_minutes.saturating_add(focus_minutes);
    global.total_focus_minutes = global.total_focus_minutes.saturating_add(focus_minutes as u64);

    score.last_updated = now_ms;

    // Calculate new Focus Score for the event
    let new_score = score.calculate_score(now_ms);

    // Emit QuizPassed attestation event — visible on Solana Explorer
    emit!(QuizPassed {
        wallet: ctx.accounts.user.key(),
        question_set_hash,
        timestamp: now_sec,
        max_difficulty,
        new_score,
        new_streak: score.current_streak,
    });

    msg!(
        "Quiz passed: wallet={} streak={} accuracy={}% score={} difficulty={}",
        ctx.accounts.user.key(),
        score.current_streak,
        score.accuracy,
        new_score,
        max_difficulty,
    );
    Ok(())
}

// ============================================================================
// RESET STREAK
// Called from WardenService when 48h passes without a quiz check-in.
// The Warden backend signs this — prevents users from resetting their own streak.
// ============================================================================

#[derive(Accounts)]
pub struct ResetStreak<'info> {
    /// Mindlock authority (Warden backend keypair, not user wallet)
    pub authority: Signer<'info>,

    /// Global stats — provides authority check
    #[account(
        seeds = [GLOBAL_STATS_SEED],
        bump = global_stats.bump,
        has_one = authority @ ScoreRegistryError::UnauthorizedAuthority,
    )]
    pub global_stats: Account<'info, GlobalStats>,

    /// UserScore to reset
    #[account(
        mut,
        seeds = [USER_SCORE_SEED, user_score.wallet.as_ref()],
        bump = user_score.bump,
    )]
    pub user_score: Account<'info, UserScore>,
}

pub fn reset_streak_handler(ctx: Context<ResetStreak>) -> Result<()> {
    let score = &mut ctx.accounts.user_score;
    let now_ms = Clock::get()?.unix_timestamp * 1000;

    msg!(
        "Streak reset: wallet={} was={} now=0",
        score.wallet,
        score.current_streak,
    );

    score.current_streak = 0;
    score.last_updated = now_ms;
    Ok(())
}

// ============================================================================
// ACTIVATE KARMA BOOST
// Called after a successful Lazy Unlock donation (redistributionAgent.ts).
// Sets karma_boost_until = now + 24h, enabling 1.2× score multiplier.
// ============================================================================

#[derive(Accounts)]
pub struct ActivateKarmaBoost<'info> {
    /// The donating user (must sign)
    #[account(mut)]
    pub user: Signer<'info>,

    /// UserScore PDA
    #[account(
        mut,
        seeds = [USER_SCORE_SEED, user.key().as_ref()],
        bump = user_score.bump,
        constraint = user_score.wallet == user.key() @ ScoreRegistryError::UnauthorizedAuthority,
    )]
    pub user_score: Account<'info, UserScore>,
}

pub fn activate_karma_boost_handler(
    ctx: Context<ActivateKarmaBoost>,
    karma_total: u64,       // New total Karma score (from karmaTracker.ts)
    boost_duration_ms: i64, // Duration in ms — capped at 48h by program
) -> Result<()> {
    // Cap boost at 48h max regardless of what client sends
    let max_boost_ms: i64 = 48 * 60 * 60 * 1000;
    require!(
        boost_duration_ms <= max_boost_ms,
        ScoreRegistryError::BoostTooLong
    );

    let score = &mut ctx.accounts.user_score;
    let now_ms = Clock::get()?.unix_timestamp * 1000;
    let expires_at = now_ms.saturating_add(boost_duration_ms);

    score.karma_boost_until = expires_at;
    score.last_updated = now_ms;

    emit!(KarmaBoostActivated {
        wallet: ctx.accounts.user.key(),
        boost_expires_at: expires_at,
        karma_total,
    });

    msg!(
        "Karma Boost activated: wallet={} expires={}ms karma={}",
        ctx.accounts.user.key(),
        expires_at,
        karma_total,
    );
    Ok(())
}

// ============================================================================
// INIT GLOBAL STATS (one-time setup, authority only)
// ============================================================================

#[derive(Accounts)]
pub struct InitGlobalStats<'info> {
    /// Authority wallet — signs + pays rent
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Global stats PDA — singleton
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalStats::INIT_SPACE,
        seeds = [GLOBAL_STATS_SEED],
        bump,
    )]
    pub global_stats: Account<'info, GlobalStats>,

    pub system_program: Program<'info, System>,
}

pub fn init_global_stats_handler(
    ctx: Context<InitGlobalStats>,
    initial_epoch_end_ms: i64,
) -> Result<()> {
    let now_sec = Clock::get()?.unix_timestamp;
    require!(
        initial_epoch_end_ms > now_sec * 1000,
        ScoreRegistryError::InvalidEpochTime
    );

    let stats = &mut ctx.accounts.global_stats;
    stats.authority = ctx.accounts.authority.key();
    stats.total_users = 0;
    stats.total_focus_minutes = 0;
    stats.total_skr_distributed = 0;
    stats.current_epoch = 1;
    stats.epoch_end_time = initial_epoch_end_ms;
    stats.bump = ctx.bumps.global_stats;

    msg!("GlobalStats initialized. Epoch 1 ends at {}ms", initial_epoch_end_ms);
    Ok(())
}

// ============================================================================
// ADVANCE EPOCH (authority only — called at the end of each weekly epoch)
// ============================================================================

#[derive(Accounts)]
pub struct AdvanceEpoch<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GLOBAL_STATS_SEED],
        bump = global_stats.bump,
        has_one = authority @ ScoreRegistryError::UnauthorizedAuthority,
    )]
    pub global_stats: Account<'info, GlobalStats>,
}

pub fn advance_epoch_handler(
    ctx: Context<AdvanceEpoch>,
    next_epoch_end_ms: i64,
    skr_distributed_this_epoch: u64,
) -> Result<()> {
    let stats = &mut ctx.accounts.global_stats;
    let now_ms = Clock::get()?.unix_timestamp * 1000;

    require!(
        next_epoch_end_ms > now_ms,
        ScoreRegistryError::InvalidEpochTime
    );

    stats.current_epoch = stats.current_epoch.saturating_add(1);
    stats.epoch_end_time = next_epoch_end_ms;
    stats.total_skr_distributed = stats
        .total_skr_distributed
        .saturating_add(skr_distributed_this_epoch);

    msg!(
        "Epoch advanced: now={} ends={}ms distributed={}",
        stats.current_epoch,
        next_epoch_end_ms,
        stats.total_skr_distributed,
    );
    Ok(())
}

use crate::state::{ScoreRegistryError, USER_SCORE_SEED, GLOBAL_STATS_SEED};
