use anchor_lang::prelude::*;

pub mod instructions;
pub mod state;

use instructions::*;

// !!! IMPORTANT !!!
// After running `anchor deploy --program-name score_registry --provider.cluster devnet`
// paste the printed Program ID here AND into src/solana/leaderboardClient.ts L8
declare_id!("A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx");

/// Mindlock Score Registry Program
///
/// Manages on-chain leaderboard state and provides verifiable quiz attestation
/// for the Mindlock discipline protocol on Solana Seeker.
///
/// ## Account Layout (must match leaderboardClient.ts)
///   UserScore  PDA: seeds=[b"user_score", wallet]
///   GlobalStats PDA: seeds=[b"global_stats"]
///
/// ## Key Design Decisions
///   - submit_score requires user signature → prevents score spoofing
///   - reset_streak requires authority signature → prevents self-reset abuse
///   - QuizPassed event is emitted on every successful quiz for on-chain attestation
///   - karma_boost_until enables the 1.2× Focus Score multiplier (24h post-donation)
#[program]
pub mod score_registry {
    use super::*;

    // -------------------------------------------------------------------------
    // Setup (run once)
    // -------------------------------------------------------------------------

    /// Initialize the global stats account (one-time, authority only)
    /// Call this immediately after deploy with the first epoch end timestamp.
    pub fn init_global_stats(
        ctx: Context<InitGlobalStats>,
        initial_epoch_end_ms: i64,
    ) -> Result<()> {
        instructions::init_global_stats_handler(ctx, initial_epoch_end_ms)
    }

    // -------------------------------------------------------------------------
    // Per-user
    // -------------------------------------------------------------------------

    /// Create a UserScore PDA for a new wallet (called on first app launch)
    pub fn init_user_score(ctx: Context<InitUserScore>) -> Result<()> {
        instructions::init_user_score_handler(ctx)
    }

    /// Record a successful quiz pass — updates stats and emits QuizPassed event
    ///
    /// Parameters:
    ///   focus_minutes      — minutes of focus time earned from this quiz (grace period)
    ///   accuracy           — 0–100, correctness percentage for this quiz attempt
    ///   question_set_hash  — SHA-256 of the question set JSON (quiz oracle content hash)
    ///   max_difficulty     — 0=Easy, 1=Medium, 2=Hard (highest difficulty answered)
    pub fn submit_score(
        ctx: Context<SubmitScore>,
        focus_minutes: u32,
        accuracy: u32,
        question_set_hash: [u8; 32],
        max_difficulty: u8,
    ) -> Result<()> {
        instructions::submit_score_handler(
            ctx,
            focus_minutes,
            accuracy,
            question_set_hash,
            max_difficulty,
        )
    }

    /// Activate the 1.2× Karma Boost after a Lazy Unlock donation
    ///
    /// Parameters:
    ///   karma_total       — user's new total Karma score
    ///   boost_duration_ms — boost duration in ms (max 48h enforced by program)
    pub fn activate_karma_boost(
        ctx: Context<ActivateKarmaBoost>,
        karma_total: u64,
        boost_duration_ms: i64,
    ) -> Result<()> {
        instructions::activate_karma_boost_handler(ctx, karma_total, boost_duration_ms)
    }

    // -------------------------------------------------------------------------
    // Authority-only
    // -------------------------------------------------------------------------

    /// Reset a user's streak (called by Warden authority when 48h check-in missed)
    pub fn reset_streak(ctx: Context<ResetStreak>) -> Result<()> {
        instructions::reset_streak_handler(ctx)
    }

    /// Advance to the next weekly epoch
    pub fn advance_epoch(
        ctx: Context<AdvanceEpoch>,
        next_epoch_end_ms: i64,
        skr_distributed_this_epoch: u64,
    ) -> Result<()> {
        instructions::advance_epoch_handler(ctx, next_epoch_end_ms, skr_distributed_this_epoch)
    }
}
