use anchor_lang::prelude::*;

/// ============================================================================
/// Mindlock Score Registry — On-Chain Leaderboard & Quiz Attestation
///
/// Accounts:
///   UserScore  — PDA per user wallet, holds all leaderboard stats
///   GlobalStats — Single global PDA, tracks total users + current epoch
///
/// Instructions:
///   init_user_score   — Create a user's score PDA (first launch)
///   submit_score      — Update stats after a successful quiz pass
///   attest_quiz       — Emit a QuizPassed event (verifiable on Explorer)
///   init_global_stats — One-time global stats setup (authority only)
/// ============================================================================

// Seeds — must match leaderboardClient.ts constants exactly
pub const USER_SCORE_SEED: &[u8] = b"user_score";
pub const GLOBAL_STATS_SEED: &[u8] = b"global_stats";

// ============================================================================
// STATE — UserScore account
// Layout must EXACTLY match leaderboardClient.ts deserializeUserScore() L192:
//   discriminator(8) + wallet(32) + focus_minutes(4) + accuracy(4)
//   + current_streak(4) + longest_streak(4) + total_earned_skr(8)
//   + last_updated(8) + karma_boost_until(8) = 80 bytes data + 8 disc = 88
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct UserScore {
    /// User's wallet public key
    pub wallet: Pubkey,         // 32 bytes

    /// Total focus minutes accumulated (from quiz passes × grace period)
    pub focus_minutes: u32,     // 4 bytes

    /// Quiz accuracy 0–100 (rolling average across all attempts)
    pub accuracy: u32,          // 4 bytes

    /// Current daily quiz streak (broken if no quiz in 48h)
    pub current_streak: u32,    // 4 bytes

    /// Highest streak ever achieved
    pub longest_streak: u32,    // 4 bytes

    /// Total $SKR earned from scholarship pool (micro-SKR, 6 decimals)
    pub total_earned_skr: u64,  // 8 bytes

    /// Unix timestamp (ms) of last score update
    pub last_updated: i64,      // 8 bytes

    /// Unix timestamp (ms) when Karma Boost expires (0 = no boost)
    pub karma_boost_until: i64, // 8 bytes

    /// Bump seed for PDA derivation
    pub bump: u8,               // 1 byte
}

impl UserScore {
    /// Focus Forge score formula (mirrors leaderboardClient.ts calculateScore())
    ///   FocusScore = streak² × (accuracy / 100) × karmaBoostMultiplier
    /// Returns score × 10 (one decimal stored as integer)
    pub fn calculate_score(&self, now_ms: i64) -> u64 {
        let streak_sq = (self.current_streak as u64).saturating_mul(self.current_streak as u64);
        let accuracy_bps = self.accuracy as u64; // 0–100
        let has_boost = self.karma_boost_until > now_ms;

        // raw = streak² × accuracy (scaled by 100 to keep precision)
        let raw = streak_sq.saturating_mul(accuracy_bps);

        // Apply 1.2× Karma Boost if active (multiply by 12, divide by 10)
        let boosted = if has_boost {
            raw.saturating_mul(12) / 10
        } else {
            raw
        };

        // Divide by 100 (accuracy was 0–100, not 0–1) → one decimal place
        boosted / 100
    }
}

// ============================================================================
// STATE — GlobalStats account (singleton)
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct GlobalStats {
    /// Mindlock authority (can update epoch)
    pub authority: Pubkey,

    /// Total number of registered users
    pub total_users: u64,

    /// Total focus minutes across all users (protocol-wide stat)
    pub total_focus_minutes: u64,

    /// Total $SKR distributed to scholars all-time
    pub total_skr_distributed: u64,

    /// Current epoch number (increments weekly)
    pub current_epoch: u64,

    /// Unix timestamp (ms) when current epoch ends
    pub epoch_end_time: i64,

    /// Bump seed
    pub bump: u8,
}

// ============================================================================
// EVENTS — emitted on Solana, verifiable on Explorer
// ============================================================================

/// Emitted every time a user passes the quiz — on-chain quiz attestation
#[event]
pub struct QuizPassed {
    /// User who passed
    pub wallet: Pubkey,

    /// SHA-256 hash of the question set JSON (content-hash oracle)
    /// Computed client-side: SHA256(JSON.stringify(questions))
    pub question_set_hash: [u8; 32],

    /// Unix timestamp (seconds)
    pub timestamp: i64,

    /// Difficulty of the hardest question answered: 0=Easy, 1=Medium, 2=Hard
    pub max_difficulty: u8,

    /// New Focus Score after this quiz
    pub new_score: u64,

    /// Current streak after this quiz
    pub new_streak: u32,
}

/// Emitted when a user earns Karma Boost (after Lazy Unlock donation)
#[event]
pub struct KarmaBoostActivated {
    pub wallet: Pubkey,
    pub boost_expires_at: i64,
    pub karma_total: u64,
}

// ============================================================================
// ERRORS
// ============================================================================
#[error_code]
pub enum ScoreRegistryError {
    #[msg("Score update too soon — minimum 1 minute between updates")]
    UpdateTooFrequent,

    #[msg("Accuracy must be between 0 and 100")]
    InvalidAccuracy,

    #[msg("Focus minutes must be positive")]
    InvalidFocusMinutes,

    #[msg("Only the program authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Karma boost duration exceeds maximum of 48 hours")]
    BoostTooLong,

    #[msg("Epoch end time must be in the future")]
    InvalidEpochTime,
}
