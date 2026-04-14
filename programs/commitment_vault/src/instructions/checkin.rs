use anchor_lang::prelude::*;

use crate::state::{CommitmentVault, constants::*};
use crate::error::VaultError;

/// Daily check-in instruction
/// 
/// SECURITY: Requires app_authority signature to prevent self-signing
/// The app authority keypair should be stored securely on backend/oracle
#[derive(Accounts)]
pub struct DailyCheckin<'info> {
    /// App authority - MUST be a signer (prevents user self-signing)
    /// This keypair is controlled by Mindlock backend/oracle
    pub app_authority: Signer<'info>,
    
    /// User who owns this commitment (for verification)
    pub user: Signer<'info>,
    
    /// Commitment vault to update
    #[account(
        mut,
        seeds = [VAULT_SEED, user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ VaultError::VaultNotActive,
        constraint = vault.user == user.key() @ VaultError::InvalidAuthority,
    )]
    pub vault: Account<'info, CommitmentVault>,
}

pub fn daily_checkin_handler(ctx: Context<DailyCheckin>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    
    // Check if streak is already complete
    require!(!vault.is_complete(), VaultError::StreakAlreadyComplete);
    
    // Check if 24 hours have passed since last check-in
    require!(
        vault.can_checkin(clock.unix_timestamp),
        VaultError::CheckinTooSoon
    );
    
    // Record check-in
    vault.days_completed = vault.days_completed.checked_add(1)
        .ok_or(VaultError::Overflow)?;
    vault.last_checkin = clock.unix_timestamp;
    
    msg!("Daily check-in #{} recorded for {}", 
        vault.days_completed, 
        vault.user
    );
    
    // Emit event for frontend
    if vault.is_complete() {
        msg!("🎉 Streak complete! User can now release funds.");
    } else {
        msg!("Progress: {}/7 days", vault.days_completed);
    }
    
    Ok(())
}
