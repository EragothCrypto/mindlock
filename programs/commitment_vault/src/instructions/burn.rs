use anchor_lang::prelude::*;

use crate::state::{CommitmentVault, constants::*};
use crate::error::VaultError;

/// Burn stake for failed commitment
/// 
/// PERMISSIONLESS: Anyone can call this after 48h since last check-in
/// Caller ("bounty hunter") receives 0.001 SOL reward
/// Remaining stake is sent to $SKR burn address
#[derive(Accounts)]
pub struct BurnStake<'info> {
    /// Anyone can trigger the burn (bounty hunter)
    #[account(mut)]
    pub cranker: Signer<'info>,
    
    /// Original user who created the commitment
    /// CHECK: Only used to derive PDA, not for authorization
    pub user: UncheckedAccount<'info>,
    
    /// Commitment vault to burn
    #[account(
        mut,
        seeds = [VAULT_SEED, user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.is_active @ VaultError::VaultNotActive,
        close = skr_burn // Return remaining lamports and close account safely
    )]
    pub vault: Account<'info, CommitmentVault>,
    
    /// $SKR burn address to receive the stake
    /// CHECK: We verify this matches the constant burn address
    #[account(
        mut,
        constraint = skr_burn.key() == SKR_BURN_ADDRESS @ VaultError::InvalidAuthority
    )]
    pub skr_burn: UncheckedAccount<'info>,
    
    /// System program for transfers
    pub system_program: Program<'info, System>,
}

pub fn burn_stake_handler(ctx: Context<BurnStake>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    
    // Verify commitment has expired (48h since last check-in)
    require!(
        vault.is_expired(clock.unix_timestamp),
        VaultError::NotExpired
    );
    
    // Calculate amounts
    let vault_balance = vault.to_account_info().lamports();
    let bounty = BOUNTY_REWARD.min(vault_balance);
    let burn_amount = vault_balance.saturating_sub(bounty);
    
    // Ensure there's enough for at least the bounty
    require!(vault_balance >= bounty, VaultError::InsufficientFunds);
    
    msg!("🔥 Burning stake for failed commitment");
    msg!("  User: {}", vault.user);
    msg!("  Bounty to cranker: {} lamports", bounty);
    msg!("  Burn to $SKR: {} lamports", burn_amount);
    
    // Transfer bounty to cranker (remaining balance goes to skr_burn via anchor 'close' constraint)
    **vault.to_account_info().try_borrow_mut_lamports()? = vault.to_account_info()
        .lamports()
        .checked_sub(bounty)
        .ok_or(VaultError::InsufficientFunds)?;
        
    **ctx.accounts.cranker.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.cranker.to_account_info()
        .lamports()
        .checked_add(bounty)
        .ok_or(VaultError::Overflow)?;
    
    // Mark vault as inactive (data zeroing is handled by Anchor close constraint)
    vault.is_active = false;
    
    msg!("✅ Burn complete. Streak failed for {}", vault.user);
    
    Ok(())
}
