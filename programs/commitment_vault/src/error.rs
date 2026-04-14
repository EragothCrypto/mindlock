use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Commitment vault is not active")]
    VaultNotActive,
    
    #[msg("Streak is not yet complete (need 7 days)")]
    StreakIncomplete,
    
    #[msg("Cannot check in yet - wait 24 hours between check-ins")]
    CheckinTooSoon,
    
    #[msg("Commitment has not expired yet - cannot burn")]
    NotExpired,
    
    #[msg("Streak already complete")]
    StreakAlreadyComplete,
    
    #[msg("Invalid authority - not authorized to sign check-ins")]
    InvalidAuthority,
    
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    
    #[msg("Arithmetic overflow")]
    Overflow,
}

/// Errors specific to reward distribution
#[error_code]
pub enum MindlockError {
    #[msg("Guardian has already voted this epoch")]
    AlreadyVoted,
    
    #[msg("Already claimed rewards this epoch - wait for next distribution")]
    AlreadyClaimedThisEpoch,
    
    #[msg("Invalid Merkle proof - focus score verification failed")]
    InvalidMerkleProof,
    
    #[msg("No rewards available to claim")]
    NoRewardsAvailable,
    
    #[msg("Epoch not ready for update - wait 7 days")]
    EpochNotReady,
    
    #[msg("Invalid guardian - not authorized to vote")]
    InvalidGuardian,
}
