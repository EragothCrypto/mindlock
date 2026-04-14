use anchor_lang::prelude::*;

/// Commitment Vault State Account
/// 
/// PDA storing user's stake and streak progress
#[account]
#[derive(InitSpace)]
pub struct CommitmentVault {
    /// User who created this commitment
    pub user: Pubkey,
    
    /// Amount staked (always 0.1 SOL = 100_000_000 lamports)
    pub amount: u64,
    
    /// Unix timestamp when commitment was created
    pub start_timestamp: i64,
    
    /// Number of days completed (0-7)
    pub days_completed: u8,
    
    /// Unix timestamp of last successful check-in
    pub last_checkin: i64,
    
    /// Whether this commitment is still active
    pub is_active: bool,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl CommitmentVault {
    /// Check if the commitment has expired (48h since last check-in)
    pub fn is_expired(&self, current_time: i64) -> bool {
        let hours_since_checkin = current_time.saturating_sub(self.last_checkin) / 3600;
        hours_since_checkin >= 48
    }
    
    /// Check if streak is complete (7 days)
    pub fn is_complete(&self) -> bool {
        self.days_completed >= 7
    }
    
    /// Check if enough time has passed for a new check-in (24h)
    pub fn can_checkin(&self, current_time: i64) -> bool {
        let hours_since_checkin = current_time.saturating_sub(self.last_checkin) / 3600;
        hours_since_checkin >= 24
    }
}

// ============================================================================
// REWARD VAULT: $SKR Scholarship Distribution with Guardian Multisig
// ============================================================================

/// Maximum number of Guardians that can vote
pub const MAX_GUARDIANS: usize = 10;

/// Reward Vault PDA - Holds $SKR for scholarship distribution
/// Seeds: ["reward_vault"]
#[account]
#[derive(InitSpace)]
pub struct RewardVault {
    /// Program authority (can add/remove guardians)
    pub authority: Pubkey,
    
    /// $SKR token mint
    pub skr_mint: Pubkey,
    
    /// Current epoch number (increments with each merkle root finalization)
    pub current_epoch: u64,
    
    /// Current merkle root for focus score verification
    pub merkle_root: [u8; 32],
    
    /// Pending merkle root (waiting for guardian votes)
    pub pending_merkle_root: [u8; 32],
    
    /// Timestamp of last merkle root update
    pub last_root_update: i64,
    
    /// Number of guardian votes required to finalize root
    pub guardian_threshold: u8,
    
    /// Number of votes received for pending root
    pub pending_votes: u8,
    
    /// Guardians who have voted this epoch (max 10)
    #[max_len(MAX_GUARDIANS)]
    pub guardian_votes: Vec<Pubkey>,
    
    /// Total $SKR distributed all-time
    pub total_distributed: u64,
    
    /// Bump seed
    pub bump: u8,
}

impl RewardVault {
    /// Check if enough votes to finalize
    pub fn has_quorum(&self) -> bool {
        self.pending_votes >= self.guardian_threshold
    }
    
    /// Check if guardian has already voted
    pub fn has_voted(&self, guardian: &Pubkey) -> bool {
        self.guardian_votes.contains(guardian)
    }
    
    /// Check if epoch claim window is open (7 days between updates)
    pub fn can_update_root(&self, current_time: i64) -> bool {
        let days_since_update = current_time.saturating_sub(self.last_root_update) / 86400;
        days_since_update >= 7
    }
}

/// User Claim PDA - Tracks user's claim history
/// Seeds: ["user_claim", user_wallet]
#[account]
#[derive(InitSpace)]
pub struct UserClaim {
    /// User wallet
    pub user: Pubkey,
    
    /// Last epoch when user claimed
    pub last_claim_epoch: u64,
    
    /// Total $SKR claimed all-time
    pub total_claimed: u64,
    
    /// Bump seed
    pub bump: u8,
}

impl UserClaim {
    /// Check if user can claim in current epoch
    pub fn can_claim(&self, current_epoch: u64) -> bool {
        self.last_claim_epoch < current_epoch
    }
}

/// Program constants
pub mod constants {
    use anchor_lang::prelude::*;
    
    /// Required stake amount: 0.1 SOL
    pub const COMMITMENT_AMOUNT: u64 = 100_000_000; // lamports
    
    /// Days required to complete streak
    pub const STREAK_DAYS_REQUIRED: u8 = 7;
    
    /// Hours before commitment is considered expired
    pub const EXPIRY_HOURS: i64 = 48;
    
    /// Bounty reward for triggering burn (0.001 SOL)
    pub const BOUNTY_REWARD: u64 = 1_000_000; // lamports
    
    /// $SKR Token Mint (Seeker ecosystem token)
    pub const SKR_MINT: Pubkey = pubkey!("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
    
    /// Vault PDA seed
    pub const VAULT_SEED: &[u8] = b"commitment_vault";
    
    /// Reward vault PDA seed
    pub const REWARD_VAULT_SEED: &[u8] = b"reward_vault";
    
    /// User claim PDA seed  
    pub const USER_CLAIM_SEED: &[u8] = b"user_claim";
    
    /// Days between merkle root updates (epoch length)
    pub const EPOCH_DAYS: i64 = 7;
    
    /// Maximum share of vault a single user can claim (10%)
    pub const MAX_SHARE_BPS: u64 = 1000; // 10% in basis points
    
    /// $SKR burn address — standard Solana black-hole (system program = unspendable)
    pub const SKR_BURN_ADDRESS: Pubkey = pubkey!("11111111111111111111111111111111");
    
    /// $SKR token decimals
    pub const SKR_DECIMALS: u8 = 9;
}
