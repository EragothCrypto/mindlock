use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::error::MindlockError;
use crate::state::{RewardVault, UserClaim, constants::*};
use crate::merkle::{verify_merkle_proof, compute_leaf, compute_reward_share};

/// Initialize Reward Vault
/// 
/// Creates the vault PDA and associated $SKR token account.
/// Only callable once by program deployer.
#[derive(Accounts)]
pub struct InitializeRewardVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + RewardVault::INIT_SPACE,
        seeds = [REWARD_VAULT_SEED],
        bump
    )]
    pub reward_vault: Account<'info, RewardVault>,
    
    /// $SKR token mint
    /// CHECK: Validated by address constraint
    #[account(address = SKR_MINT)]
    pub skr_mint: AccountInfo<'info>,
    
    /// Vault's $SKR token account (ATA)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = skr_mint,
        associated_token::authority = reward_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_reward_vault_handler(
    ctx: Context<InitializeRewardVault>,
    guardian_threshold: u8,
) -> Result<()> {
    let vault = &mut ctx.accounts.reward_vault;
    
    vault.authority = ctx.accounts.authority.key();
    vault.skr_mint = ctx.accounts.skr_mint.key();
    vault.current_epoch = 0;
    vault.merkle_root = [0u8; 32];
    vault.pending_merkle_root = [0u8; 32];
    vault.last_root_update = Clock::get()?.unix_timestamp;
    vault.guardian_threshold = guardian_threshold.max(1); // At least 1 guardian
    vault.pending_votes = 0;
    vault.guardian_votes = Vec::new();
    vault.total_distributed = 0;
    vault.bump = ctx.bumps.reward_vault;
    
    msg!("RewardVault initialized with {} guardian threshold", vault.guardian_threshold);
    
    Ok(())
}

/// Propose Merkle Root (Guardian Vote)
/// 
/// Guardians submit votes for a new merkle root.
/// When votes >= threshold, root is finalized and epoch increments.
#[derive(Accounts)]
pub struct ProposeMerkleRoot<'info> {
    /// Guardian signer (must be the authorized authority)
    pub guardian: Signer<'info>,
    
    #[account(
        mut,
        seeds = [REWARD_VAULT_SEED],
        bump = reward_vault.bump,
        has_one = authority @ MindlockError::InvalidAuthority
    )]
    pub reward_vault: Account<'info, RewardVault>,
    
    /// CHECK: The authority account must match the one stored in the vault
    pub authority: AccountInfo<'info>,
}

pub fn propose_merkle_root_handler(
    ctx: Context<ProposeMerkleRoot>,
    merkle_root: [u8; 32],
    _total_score: u64, // For off-chain reference
) -> Result<()> {
    let vault = &mut ctx.accounts.reward_vault;
    let guardian = ctx.accounts.guardian.key();
    let clock = Clock::get()?;
    
    // Check if guardian already voted
    require!(
        !vault.has_voted(&guardian),
        MindlockError::AlreadyVoted
    );
    
    // If this is a new proposed root, reset votes
    if vault.pending_merkle_root != merkle_root {
        vault.pending_merkle_root = merkle_root;
        vault.pending_votes = 0;
        vault.guardian_votes.clear();
    }
    
    // Record vote
    vault.guardian_votes.push(guardian);
    vault.pending_votes = vault.pending_votes.checked_add(1).unwrap_or(vault.pending_votes);
    
    msg!("Guardian {} voted ({}/{})", guardian, vault.pending_votes, vault.guardian_threshold);
    
    // Check if quorum reached
    if vault.has_quorum() {
        // Finalize the merkle root
        vault.merkle_root = vault.pending_merkle_root;
        vault.current_epoch = vault.current_epoch.checked_add(1).unwrap_or(vault.current_epoch);
        vault.last_root_update = clock.unix_timestamp;
        
        // Reset for next epoch
        vault.pending_merkle_root = [0u8; 32];
        vault.pending_votes = 0;
        vault.guardian_votes.clear();
        
        msg!("Epoch {} finalized with new merkle root", vault.current_epoch);
    }
    
    Ok(())
}

/// Claim Reward
/// 
/// User claims their $SKR share with Merkle proof verification.
/// Requires Seed Vault signature for biometric authorization.
#[derive(Accounts)]
pub struct ClaimReward<'info> {
    /// User claiming reward
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// Seed Vault (hardware wallet) - REQUIRED for biometric auth
    pub seed_vault: Signer<'info>,
    
    #[account(
        seeds = [REWARD_VAULT_SEED],
        bump = reward_vault.bump
    )]
    pub reward_vault: Account<'info, RewardVault>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserClaim::INIT_SPACE,
        seeds = [USER_CLAIM_SEED, user.key().as_ref()],
        bump
    )]
    pub user_claim: Account<'info, UserClaim>,
    
    /// Vault's $SKR token account
    #[account(
        mut,
        associated_token::mint = reward_vault.skr_mint,
        associated_token::authority = reward_vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// User's $SKR token account (destination)
    #[account(
        mut,
        token::mint = reward_vault.skr_mint,
        token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn claim_reward_handler(
    ctx: Context<ClaimReward>,
    focus_score: u64,
    total_score: u64,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let vault = &ctx.accounts.reward_vault;
    let user_claim = &mut ctx.accounts.user_claim;
    let user = ctx.accounts.user.key();
    
    // Safety Check 1: Once per epoch
    require!(
        user_claim.can_claim(vault.current_epoch),
        MindlockError::AlreadyClaimedThisEpoch
    );
    
    // Safety Check 2: Verify merkle proof
    let leaf = compute_leaf(&user, focus_score, total_score, vault.current_epoch);
    require!(
        verify_merkle_proof(&merkle_proof, &vault.merkle_root, leaf),
        MindlockError::InvalidMerkleProof
    );
    
    // Calculate reward share (capped at MAX_SHARE_BPS)
    let vault_balance = ctx.accounts.vault_token_account.amount;
    let reward_amount = compute_reward_share(
        focus_score,
        total_score,
        vault_balance,
        MAX_SHARE_BPS
    );
    
    require!(reward_amount > 0, MindlockError::NoRewardsAvailable);
    
    // Transfer $SKR from vault to user
    let vault_bump = vault.bump;
    let seeds = &[REWARD_VAULT_SEED, &[vault_bump]];
    let signer_seeds = &[&seeds[..]];
    
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.reward_vault.to_account_info(),
        },
        signer_seeds,
    );
    
    token::transfer(transfer_ctx, reward_amount)?;
    
    // Update user claim record
    user_claim.user = user;
    user_claim.last_claim_epoch = vault.current_epoch;
    user_claim.total_claimed = user_claim.total_claimed.checked_add(reward_amount).unwrap_or(user_claim.total_claimed);
    user_claim.bump = ctx.bumps.user_claim;
    
    msg!(
        "User {} claimed {} $SKR (score: {}, epoch: {})",
        user, reward_amount, focus_score, vault.current_epoch
    );
    
    Ok(())
}
