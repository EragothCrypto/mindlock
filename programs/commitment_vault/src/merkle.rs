use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

/// Merkle proof verification for focus score claims
/// 
/// The merkle tree structure:
/// - Leaf = keccak256(user_wallet || focus_score || epoch)
/// - Root is updated weekly by Guardian multisig
pub fn verify_merkle_proof(proof: &[[u8; 32]], root: &[u8; 32], leaf: [u8; 32]) -> bool {
    // Prevent unbounded loop execution (Max 32 depth = 4.29 billion leaves)
    if proof.len() > 32 {
        return false;
    }
    
    let mut computed_hash = leaf;
    
    for proof_element in proof.iter() {
        // Sort hashes to ensure consistent tree structure
        if computed_hash <= *proof_element {
            computed_hash = keccak::hashv(&[&computed_hash, proof_element]).0;
        } else {
            computed_hash = keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }
    
    computed_hash == *root
}

/// Compute leaf hash from user data
pub fn compute_leaf(user: &Pubkey, focus_score: u64, total_score: u64, epoch: u64) -> [u8; 32] {
    keccak::hashv(&[
        user.as_ref(),
        &focus_score.to_le_bytes(),
        &total_score.to_le_bytes(),
        &epoch.to_le_bytes(),
    ]).0
}

/// Compute the $SKR reward share based on focus score
/// 
/// Formula: share = (focus_score / total_score) * vault_balance
/// Capped at MAX_SHARE_BPS (10%) of vault to prevent drain
pub fn compute_reward_share(
    focus_score: u64,
    total_score: u64,
    vault_balance: u64,
    max_share_bps: u64,
) -> u64 {
    if total_score == 0 || vault_balance == 0 {
        return 0;
    }
    
    // Calculate proportional share
    let share = (focus_score as u128)
        .checked_mul(vault_balance as u128)
        .unwrap_or(0)
        .checked_div(total_score as u128)
        .unwrap_or(0) as u64;
    
    // Cap at maximum share
    let max_amount = (vault_balance as u128)
        .checked_mul(max_share_bps as u128)
        .unwrap_or(0)
        .checked_div(10_000)
        .unwrap_or(0) as u64;
    
    share.min(max_amount)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_compute_reward_share() {
        // User has 100 focus score out of 1000 total = 10%
        // Vault has 10000 tokens, max share is 10%
        let share = compute_reward_share(100, 1000, 10000, 1000);
        assert_eq!(share, 1000); // 10% of 10000
        
        // User has 500 focus score = 50%, but capped at 10%
        let share = compute_reward_share(500, 1000, 10000, 1000);
        assert_eq!(share, 1000); // Capped at 10%
    }
}
