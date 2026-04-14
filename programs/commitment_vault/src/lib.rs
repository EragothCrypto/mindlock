use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod merkle;
pub mod state;

use instructions::*;

declare_id!("5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC");

/// Mindlock Commitment Vault Program
/// 
/// Users stake 0.1 SOL as commitment to a 7-day learning streak.
/// - On success: funds are released back to user
/// - On failure (48h no check-in): anyone can trigger burn to $SKR
/// 
/// ## Reward Distribution (Guardian Multisig)
/// - `initialize_reward_vault`: Create $SKR reward vault
/// - `propose_merkle_root`: Guardian-weighted voting for score updates
/// - `claim_reward`: Seed Vault biometric claim with Merkle verification
#[program]
pub mod commitment_vault {
    use super::*;

    /// Create a new commitment vault with 0.1 SOL deposit
    pub fn create_commitment(ctx: Context<CreateCommitment>) -> Result<()> {
        instructions::create::create_commitment_handler(ctx)
    }

    /// Record a daily check-in (requires app authority signature)
    pub fn daily_checkin(ctx: Context<DailyCheckin>) -> Result<()> {
        instructions::checkin::daily_checkin_handler(ctx)
    }

    /// Release funds back to user after completing 7-day streak
    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        instructions::release::release_funds_handler(ctx)
    }

    /// Burn stake to $SKR if user failed (permissionless after 48h)
    /// Caller receives 0.001 SOL bounty for triggering
    pub fn burn_stake(ctx: Context<BurnStake>) -> Result<()> {
        instructions::burn::burn_stake_handler(ctx)
    }

    // ========================================================================
    // REWARD DISTRIBUTION - Guardian Multisig + Seed Vault Biometric Claims
    // ========================================================================

    /// Initialize the $SKR reward vault (one-time setup)
    pub fn initialize_reward_vault(
        ctx: Context<InitializeRewardVault>,
        guardian_threshold: u8,
    ) -> Result<()> {
        instructions::reward_vault::initialize_reward_vault_handler(ctx, guardian_threshold)
    }

    /// Guardian votes for new merkle root (decentralized epoch updates)
    pub fn propose_merkle_root(
        ctx: Context<ProposeMerkleRoot>,
        merkle_root: [u8; 32],
        total_score: u64,
    ) -> Result<()> {
        instructions::reward_vault::propose_merkle_root_handler(ctx, merkle_root, total_score)
    }

    /// Claim $SKR reward with Merkle proof (requires Seed Vault biometric)
    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        focus_score: u64,
        total_score: u64,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::reward_vault::claim_reward_handler(ctx, focus_score, total_score, merkle_proof)
    }
}
