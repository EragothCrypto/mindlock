import {
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';
import { calculateLeaderboardScore, UserStats } from '../hooks/useUserStats';

// Distribution config
export const TOP_USERS_COUNT = 10; // Top 10 get rewards
export const EPOCH_DURATION_DAYS = 30; // Monthly distribution

interface UserScore {
    wallet: PublicKey;
    stats: UserStats;
    score: number;
    proportionalShare: number;
}

interface DistributionResult {
    success: boolean;
    totalDistributed: number;
    recipients: { wallet: string; amount: number }[];
    txSignature?: string;
    error?: string;
}

/**
 * Epoch Distribution Logic
 * 
 * At the end of each month:
 * 1. Fetch top N users by score (accuracy + streaks)
 * 2. Calculate proportional share of vault
 * 3. Distribute $SKR to winners
 * 
 * This is a permissionless function - anyone can trigger it
 * once the epoch has ended.
 */
export class EpochDistributor {
    private connection: Connection;

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    /**
     * Check if current epoch has ended
     */
    isEpochEnded(): boolean {
        const now = new Date();
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return now >= lastDayOfMonth;
    }

    /**
     * Calculate proportional shares for distribution
     * 
     * Score formula: (accuracy * 0.5) + (streak_bonus * 0.5)
     * Share = user_score / total_scores
     */
    calculateShares(users: { wallet: PublicKey; stats: UserStats }[]): UserScore[] {
        // Calculate scores
        const scoredUsers = users.map(u => ({
            ...u,
            score: calculateLeaderboardScore(u.stats),
            proportionalShare: 0,
        }));

        // Sort by score descending
        scoredUsers.sort((a, b) => b.score - a.score);

        // Take top N
        const topUsers = scoredUsers.slice(0, TOP_USERS_COUNT);

        // Calculate total score of top users
        const totalScore = topUsers.reduce((sum, u) => sum + u.score, 0);

        // Calculate proportional shares
        if (totalScore > 0) {
            topUsers.forEach(u => {
                u.proportionalShare = u.score / totalScore;
            });
        }

        return topUsers;
    }

    /**
     * Get time until next distribution
     */
    getTimeUntilNextEpoch(): { days: number; hours: number; minutes: number } {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const msRemaining = endOfMonth.getTime() - now.getTime();

        const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

        return { days, hours, minutes };
    }

    /**
     * Format distribution breakdown for display
     */
    formatDistributionPreview(
        vaultBalance: number,
        shares: UserScore[]
    ): string[] {
        return shares.map((user, index) => {
            const amount = vaultBalance * user.proportionalShare;
            const shortWallet = `${user.wallet.toString().slice(0, 4)}...${user.wallet.toString().slice(-4)}`;
            return `#${index + 1} ${shortWallet}: ${amount.toFixed(2)} $SKR (${(user.proportionalShare * 100).toFixed(1)}%)`;
        });
    }
}

export const epochDistributor = new EpochDistributor();
export default epochDistributor;
