/**
 * Scholarship Vault - Weekly Reward Distribution
 * 
 * This module manages the scholarship fund accumulated from lazy unlocks
 * and handles weekly reward distribution to top learners.
 * 
 * Distribution:
 * - 💎 Diamond Sages (Top 1%): 40% of pool
 * - 💚 Emerald Scholars (Top 10%): 30% of pool
 * - ⚔️ Steel Disciplines (Top 25%): 20% of pool
 * - 💝 Charity: 10% goes back to charity
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { NETWORK_CONFIG } from '../config/network';
import { SKR_TOKEN_MINT, SKR_DECIMALS, jupiterSwap } from './jupiterSwap';
import { SCHOLARSHIP_WALLET_ADDRESS_DEVNET, FUND_SPLIT } from './redistributionAgent';
import { leaderboardClient, REWARD_TIERS, UserTier } from './leaderboardClient';
import { mwaSignTransaction } from './mwaWallet';
import { kaminoYield, EpochYieldEstimate } from './kaminoYield';

// ============================================================================
// EPOCH CONFIGURATION
// ============================================================================

/**
 * Epoch timing - Rewards distribute weekly on Sunday 00:00 UTC
 */
const EPOCH_DAY = 0; // Sunday
const EPOCH_HOUR_UTC = 0; // Midnight UTC

// Active scholarship wallet
const ACTIVE_SCHOLARSHIP_WALLET = SCHOLARSHIP_WALLET_ADDRESS_DEVNET;

// ============================================================================
// INTERFACES
// ============================================================================

export interface ScholarshipStats {
    vaultBalance: number;        // Current $SKR in vault
    estimatedUsd: number;        // USD equivalent
    epochEnd: Date;              // When current epoch ends
    daysRemaining: number;
    hoursRemaining: number;
    totalDistributed: number;    // All-time distributed
    totalRecipients: number;     // All-time recipients
    // Kamino yield fields
    kaminoApy: number;           // Current APY from Kamino (e.g. 8.35)
    kaminoYieldSkr: number;      // Estimated $SKR yield this epoch
    kaminoYieldUsd: number;      // Estimated USD yield this epoch
    kaminoProjectedEnd: number;  // Projected vault balance at epoch end
    kaminoStrategyLabel: string; // e.g. "USDC/SOL Vault"
    kaminoIsLive: boolean;       // false = using fallback APY
}

export interface ClaimResult {
    success: boolean;
    skrAmount: number;
    usdValue: number;
    tier: UserTier;
    txSignature?: string;
    error?: string;
}

export interface RewardEstimate {
    eligible: boolean;
    tier: UserTier;
    estimatedSkr: number;
    estimatedUsd: number;
    rank: number;
    totalUsers: number;
}

// ============================================================================
// SCHOLARSHIP VAULT CLASS
// ============================================================================

class ScholarshipVault {
    private connection: Connection;

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    /**
     * Get current vault balance
     */
    async getVaultBalance(): Promise<{ skr: number; usd: number }> {
        try {
            const vaultTokenAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                ACTIVE_SCHOLARSHIP_WALLET
            );

            const info = await this.connection.getTokenAccountBalance(vaultTokenAccount);
            const balance = info.value.uiAmount || 0;

            // Get live $SKR price from Jupiter
            let skrPrice = 0.001;
            try { skrPrice = await jupiterSwap.getSkrPriceInUsd(); } catch {}
            const usdValue = balance * skrPrice;

            return { skr: balance, usd: usdValue };
        } catch (error) {
            __DEV__ && console.log('Vault balance check failed (may not exist yet):', error);
            return { skr: 0, usd: 0 };
        }
    }

    /**
     * Get scholarship vault stats
     */
    async getStats(): Promise<ScholarshipStats> {
        const { skr, usd } = await this.getVaultBalance();
        const epochInfo = this.getEpochEnd();

        // Fetch live SKR price and Kamino yield in parallel
        let skrPrice = 0.001;
        let yieldEstimate: EpochYieldEstimate | null = null;
        try {
            [skrPrice, yieldEstimate] = await Promise.all([
                jupiterSwap.getSkrPriceInUsd(),
                kaminoYield.calculateEpochYield(skr, skrPrice),
            ]);
            // Re-run with the real price
            yieldEstimate = await kaminoYield.calculateEpochYield(skr, skrPrice);
        } catch {
            // Non-fatal — yield display degrades gracefully
        }

        return {
            vaultBalance: skr,
            estimatedUsd: usd,
            epochEnd: epochInfo.endDate,
            daysRemaining: epochInfo.days,
            hoursRemaining: epochInfo.hours,
            totalDistributed: 0,
            totalRecipients: 0,
            kaminoApy: yieldEstimate?.apy ?? 8.35,
            kaminoYieldSkr: yieldEstimate?.yieldThisEpochSkr ?? 0,
            kaminoYieldUsd: yieldEstimate?.yieldThisEpochUsd ?? 0,
            kaminoProjectedEnd: yieldEstimate?.projectedEpochEndSkr ?? skr,
            kaminoStrategyLabel: yieldEstimate?.strategy.strategyLabel ?? 'USDC/SOL Vault',
            kaminoIsLive: yieldEstimate?.strategy.isLive ?? false,
        };
    }

    /**
     * Get epoch end (next Sunday 00:00 UTC)
     */
    getEpochEnd(): { days: number; hours: number; endDate: Date } {
        const now = new Date();
        const currentDay = now.getUTCDay();

        // Calculate days until next Sunday
        let daysUntilSunday = (EPOCH_DAY - currentDay + 7) % 7;
        if (daysUntilSunday === 0 && now.getUTCHours() >= EPOCH_HOUR_UTC) {
            daysUntilSunday = 7; // Already past this week's epoch
        }

        const endDate = new Date(now);
        endDate.setUTCDate(now.getUTCDate() + daysUntilSunday);
        endDate.setUTCHours(EPOCH_HOUR_UTC, 0, 0, 0);

        const msRemaining = endDate.getTime() - now.getTime();
        const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        return { days, hours, endDate };
    }

    /**
     * Estimate reward for a user based on current standings
     */
    async estimateReward(walletAddress: string): Promise<RewardEstimate> {
        const { skr: vaultBalance } = await this.getVaultBalance();
        const topScores = await leaderboardClient.fetchTopScores(100);

        // Find user's rank
        const userIdx = topScores.findIndex(e => e.walletFull === walletAddress);
        const rank = userIdx >= 0 ? userIdx + 1 : topScores.length + 1;
        const totalUsers = Math.max(topScores.length, 100); // Assume at least 100 users

        const tier = leaderboardClient.getUserTier(rank, totalUsers);

        if (tier.tier === 'UNRANKED') {
            return {
                eligible: false,
                tier,
                estimatedSkr: 0,
                estimatedUsd: 0,
                rank,
                totalUsers,
            };
        }

        // Count users in this tier
        const tierCutoff = Math.ceil(totalUsers * tier.percentile / 100);
        const tierUserCount = Math.max(1, tierCutoff);

        // Calculate share
        const tierPoolAmount = (tier.poolShare / 100) * vaultBalance;
        const perUserAmount = tierPoolAmount / tierUserCount;
        const estimatedSkrPrice = 0.001;

        return {
            eligible: true,
            tier,
            estimatedSkr: Math.round(perUserAmount),
            estimatedUsd: Math.round(perUserAmount * estimatedSkrPrice * 100) / 100,
            rank,
            totalUsers,
        };
    }

    /**
     * Claim reward - Requires Seed Vault biometric (Proof of Personhood)
     * 
     * This function:
     * 1. Verifies user is eligible for reward
     * 2. Requires MWA transaction signing (biometric!)
     * 3. Transfers $SKR from vault to user
     * 
     * The Seed Vault biometric requirement prevents bot farms from
     * automated claiming across emulated devices.
     */
    async claimReward(
        userPublicKey: PublicKey,
        signTransaction: (tx: Transaction) => Promise<Transaction>,
    ): Promise<ClaimResult> {
        try {
            // 1. Check eligibility
            const estimate = await this.estimateReward(userPublicKey.toString());

            if (!estimate.eligible || estimate.estimatedSkr <= 0) {
                return {
                    success: false,
                    skrAmount: 0,
                    usdValue: 0,
                    tier: estimate.tier,
                    error: 'Not eligible for rewards. Reach top 25% to qualify!',
                };
            }

            __DEV__ && console.log(`🎓 Claiming ${estimate.tier.emoji} ${estimate.tier.name} reward...`);
            __DEV__ && console.log(`   Estimated: ${estimate.estimatedSkr} $SKR (~$${estimate.estimatedUsd})`);

            // 2. Get user's token account
            const userSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                userPublicKey
            );

            // 3. Get vault's token account
            const vaultSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                ACTIVE_SCHOLARSHIP_WALLET
            );

            // 4. Calculate claim amount in lamports
            const claimLamports = Math.floor(estimate.estimatedSkr * Math.pow(10, SKR_DECIMALS));

            // 5. Create transfer instruction (Vault → User)
            const transferIx = createTransferInstruction(
                vaultSkrAccount,
                userSkrAccount,
                ACTIVE_SCHOLARSHIP_WALLET, // Vault is the signer
                claimLamports,
                [],
                TOKEN_PROGRAM_ID
            );

            // 6. Build transaction
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

            const transaction = new Transaction({
                feePayer: userPublicKey,
                blockhash,
                lastValidBlockHeight,
            });

            transaction.add(transferIx);

            // 7. PROOF OF PERSONHOOD: Sign with Seed Vault (biometric!) 🔐
            // This is the critical anti-bot step - requires physical device + biometric
            __DEV__ && console.log('🔐 Requesting Seed Vault signature (biometric required)...');
            const signedTx = await signTransaction(transaction);

            // 8. Send and confirm
            const txSignature = await this.connection.sendRawTransaction(
                signedTx.serialize()
            );

            await this.connection.confirmTransaction({
                signature: txSignature,
                blockhash,
                lastValidBlockHeight,
            }, 'confirmed');

            __DEV__ && console.log(`🎓 Scholarship claimed! ${estimate.estimatedSkr} $SKR`);

            return {
                success: true,
                skrAmount: estimate.estimatedSkr,
                usdValue: estimate.estimatedUsd,
                tier: estimate.tier,
                txSignature,
            };
        } catch (error) {
            console.error('Scholarship claim failed:', error);
            return {
                success: false,
                skrAmount: 0,
                usdValue: 0,
                tier: { tier: 'UNRANKED', name: 'Unranked', emoji: '🔘', percentile: 100, poolShare: 0 },
                error: error instanceof Error ? error.message : 'Claim failed',
            };
        }
    }

    /**
     * Format remaining time for display
     */
    formatTimeRemaining(days: number, hours: number): string {
        if (days > 0) {
            return `${days}d ${hours}h`;
        }
        return `${hours}h`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const scholarshipVault = new ScholarshipVault();
export default scholarshipVault;
