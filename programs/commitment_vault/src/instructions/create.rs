use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::{CommitmentVault, constants::*};

/// Create a new commitment vault
/// 
/// User deposits 0.1 SOL to start their 7-day learning streak
#[derive(Accounts)]
pub struct CreateCommitment<'info> {
    /// User creating the commitment
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Commitment vault PDA to create
    #[account(
        init,
        payer = user,
        space = 8 + CommitmentVault::INIT_SPACE,
        seeds = [VAULT_SEED, user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, CommitmentVault>,
    
    /// System program for account creation and transfer
    pub system_program: Program<'info, System>,
}

pub fn create_commitment_handler(ctx: Context<CreateCommitment>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;
    
    // Transfer 0.1 SOL from user to vault
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: vault.to_account_info(),
            },
        ),
        COMMITMENT_AMOUNT,
    )?;
    
    // Initialize vault state
    vault.user = ctx.accounts.user.key();
    vault.amount = COMMITMENT_AMOUNT;
    vault.start_timestamp = clock.unix_timestamp;
    vault.days_completed = 0;
    vault.last_checkin = clock.unix_timestamp; // Start fresh
    vault.is_active = true;
    vault.bump = ctx.bumps.vault;
    
    msg!("Commitment created: {} staked {} lamports", 
        vault.user, 
        vault.amount
    );
    
    Ok(())
}
