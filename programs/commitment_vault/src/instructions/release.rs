use anchor_lang::prelude::*;

use crate::state::{CommitmentVault, constants::*};
use crate::error::VaultError;

/// Release funds after completing 7-day streak
/// 
/// User can claim back their 0.1 SOL after successfully completing
/// all 7 daily check-ins
#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    /// User claiming their funds back
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Commitment vault to close
    #[account(
        mut,
        seeds = [VAULT_SEED, user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ VaultError::VaultNotActive,
        constraint = vault.user == user.key() @ VaultError::InvalidAuthority,
        constraint = vault.is_complete() @ VaultError::StreakIncomplete,
        close = user, // Return rent to user
    )]
    pub vault: Account<'info, CommitmentVault>,
    
    /// System program for transfers
    pub system_program: Program<'info, System>,
}

pub fn release_funds_handler(ctx: Context<ReleaseFunds>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    
    msg!("🎉 Releasing {} lamports to {} after completing 7-day streak!", 
        vault.amount, 
        vault.user
    );
    
    // Note: The `close = user` constraint automatically transfers
    // all lamports from vault account to user when the account closes
    
    // The vault.amount was already in the account balance,
    // so closing the account returns everything to user
    
    Ok(())
}
