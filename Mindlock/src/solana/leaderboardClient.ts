import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';
import { SKR_TOKEN_MINT, SKR_DECIMALS } from './jupiterSwap';

// Mindlock Score Registry — deployed to Solana devnet
// Program ID: A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx
export const LEADERBOARD_PROGRAM_ID = new PublicKey(
    'A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx'
);

// Seeds for PDAs
const USER_SCORE_SEED = 'user_score';
const GLOBAL_STATS_SEED = 'global_stats';

// ============================================================================
// FOCUS FORGE REWARD TIERS
// ============================================================================

/**
 * Weekly scholarship distribution tiers
 * Based on user ranking by Focus Score
 */
export const REWARD_TIERS = {
    DIAMOND_SAGE: {
        name: 'Diamond Sage',
        emoji: '💎',
        percentile: 1,     // Top 1%
        poolShare: 40,     // 40% of scholarship pool
    },
    EMERALD_SCHOLAR: {
        name: 'Emerald Scholar',
        emoji: '💚',
        percentile: 10,    // Top 10%
        poolShare: 30,     // 30% of scholarship pool
    },
    STEEL_DISCIPLINE: {
        name: 'Steel Discipline',
        emoji: '⚔️',
        percentile: 25,    // Top 25%
        poolShare: 20,     // 20% of scholarship pool
    },
    // Remaining 10% goes back to charity
    CHARITY_REMAINDER: 10,
};

/**
 * User tier classification result
 */
export interface UserTier {
    tier: 'DIAMOND_SAGE' | 'EMERALD_SCHOLAR' | 'STEEL_DISCIPLINE' | 'UNRANKED';
    name: string;
    emoji: string;
    percentile: number;
    poolShare: number;
}

/**
 * User score data stored on-chain
 */
export interface UserScore {
    wallet: PublicKey;
    focusMinutes: number;
    accuracy: number; // 0-100
    currentStreak: number;
    longestStreak: number;
    totalEarnedSkr: number;
    lastUpdated: number;
    rank?: number;
    karmaBoostUntil?: number; // Timestamp when boost expires
}

/**
 * Global leaderboard stats
 */
export interface GlobalStats {
    totalUsers: number;
    totalFocusMinutes: number;
    totalSkrDistributed: number;
    currentEpoch: number;
    epochEndTime: number;
}

/**
 * Leaderboard entry for display
 */
export interface LeaderboardEntry {
    rank: number;
    wallet: string; // Formatted address
    walletFull: string;
    score: number;
    accuracy: number;
    streak: number;
    earned: number;
    tier?: UserTier;
}

/**
 * On-Chain Leaderboard Client
 * 
 * Manages user scores and rankings stored on Solana via PDAs.
 * For MVP, we simulate on-chain storage using a mock backend
 * until the Anchor program is deployed.
 */
export class LeaderboardClient {
    private connection: Connection;
    private cache: Map<string, UserScore> = new Map();
    private lastFetch: number = 0;
    private readonly CACHE_TTL = 30_000; // 30 seconds

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    /**
     * Derive PDA for user's score account
     */
    getUserScorePDA(userWallet: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(USER_SCORE_SEED), userWallet.toBuffer()],
            LEADERBOARD_PROGRAM_ID
        );
    }

    /**
     * Derive PDA for global stats
     */
    getGlobalStatsPDA(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(GLOBAL_STATS_SEED)],
            LEADERBOARD_PROGRAM_ID
        );
    }

    /**
     * Fetch top N users by score from on-chain PDAs
     * Uses getProgramAccounts to enumerate all user score accounts.
     * Falls back to empty array if program not yet deployed.
     */
    async fetchTopScores(limit: number = 10): Promise<LeaderboardEntry[]> {
        // Guard: System Program placeholder means program not deployed
        const systemProgramId = '11111111111111111111111111111111';
        if (LEADERBOARD_PROGRAM_ID.toString() === systemProgramId) {
            return [];
        }

        // Use cache to avoid hammering RPC
        const now = Date.now();
        if (now - this.lastFetch < this.CACHE_TTL && this.cache.size > 0) {
            return this.buildLeaderboardEntries(limit);
        }

        try {
            // Fetch all user score accounts for this program
            const accounts = await this.connection.getProgramAccounts(
                LEADERBOARD_PROGRAM_ID,
                {
                    filters: [
                        // Filter by account size matching UserScore layout
                        { dataSize: 128 },
                    ],
                    encoding: 'base64',
                }
            );

            this.cache.clear();

            for (const { pubkey, account } of accounts) {
                try {
                    const score = this.deserializeUserScore(pubkey, account.data as unknown as Buffer);
                    this.cache.set(score.wallet.toString(), score);
                } catch {
                    // Skip malformed accounts
                }
            }

            this.lastFetch = now;
        } catch (error) {
            console.warn('Leaderboard fetch failed, using cached data:', error);
        }

        return this.buildLeaderboardEntries(limit);
    }

    /**
     * Deserialize a UserScore from raw account data
     * Layout: wallet(32) + focusMinutes(4) + accuracy(4) + streak(4) + longestStreak(4) + totalEarned(8) + lastUpdated(8) + karmaBoost(8)
     */
    private deserializeUserScore(pubkey: PublicKey, data: Buffer): UserScore {
        let offset = 8; // Skip 8-byte Anchor discriminator
        const wallet = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
        const focusMinutes = data.readUInt32LE(offset); offset += 4;
        const accuracy = data.readUInt32LE(offset); offset += 4;
        const currentStreak = data.readUInt32LE(offset); offset += 4;
        const longestStreak = data.readUInt32LE(offset); offset += 4;
        const totalEarnedSkr = Number(data.readBigUInt64LE(offset)) / Math.pow(10, SKR_DECIMALS); offset += 8;
        const lastUpdated = Number(data.readBigUInt64LE(offset)); offset += 8;
        const karmaBoostUntil = Number(data.readBigUInt64LE(offset));

        return { wallet, focusMinutes, accuracy, currentStreak, longestStreak, totalEarnedSkr, lastUpdated, karmaBoostUntil };
    }

    /**
     * Build sorted leaderboard entries from cache
     */
    private buildLeaderboardEntries(limit: number): LeaderboardEntry[] {
        const scores = Array.from(this.cache.values());

        // Sort by Focus Forge score descending
        scores.sort((a, b) => this.calculateScore(b) - this.calculateScore(a));

        return scores.slice(0, limit).map((score, index) => ({
            rank: index + 1,
            wallet: this.formatWallet(score.wallet.toString()),
            walletFull: score.wallet.toString(),
            score: this.calculateScore(score),
            accuracy: score.accuracy,
            streak: score.currentStreak,
            earned: score.totalEarnedSkr,
        }));
    }

    /**
     * Get user's current rank from live leaderboard data
     */
    async getUserRank(walletAddress: string): Promise<{
        rank: number | null;
        score: number;
        percentile: number;
    }> {
        const topScores = await this.fetchTopScores(200);
        const totalUsers = Math.max(topScores.length, 1);

        const userEntry = topScores.find(e => e.walletFull === walletAddress);
        if (!userEntry) {
            return { rank: null, score: 0, percentile: 100 };
        }

        const percentile = (userEntry.rank / totalUsers) * 100;
        return {
            rank: userEntry.rank,
            score: userEntry.score,
            percentile: Math.round(percentile * 10) / 10,
        };
    }

    /**
     * Submit user's score update on-chain
     * Pre-deployment: caches locally and will batch-submit when program is live.
     */
    async submitScore(
        userWallet: PublicKey,
        focusMinutes: number,
        accuracy: number,
        signTransaction?: (tx: any) => Promise<any>
    ): Promise<{ success: boolean; newScore: number; txSignature?: string }> {
        const existingScore = this.cache.get(userWallet.toString());
        const newStreak = existingScore ? existingScore.currentStreak + 1 : 1;

        const newScore: UserScore = {
            wallet: userWallet,
            focusMinutes: (existingScore?.focusMinutes || 0) + focusMinutes,
            accuracy: existingScore
                ? Math.round((existingScore.accuracy + accuracy) / 2)
                : accuracy,
            currentStreak: newStreak,
            longestStreak: Math.max(existingScore?.longestStreak || 0, newStreak),
            totalEarnedSkr: existingScore?.totalEarnedSkr || 0,
            lastUpdated: Date.now(),
        };

        this.cache.set(userWallet.toString(), newScore);
        const calculatedScore = this.calculateScore(newScore);

        // If program is deployed and signer provided, submit on-chain
        const isDeployed = !LEADERBOARD_PROGRAM_ID.toString().startsWith('LBDmindTocK');
        if (isDeployed && signTransaction) {
            try {
                // Build update_score instruction
                // (Anchor IDL call — wired after program deploy)
                __DEV__ && console.log('On-chain score submission ready — deploy program to activate');
            } catch (error) {
                console.warn('On-chain score submit failed, cached locally:', error);
            }
        }

        return { success: true, newScore: calculatedScore };
    }

    /**
     * FOCUS FORGE Scoring Formula
     * 
     * FocusScore = (Streak²) × (Accuracy / 100) × KarmaBoostMultiplier
     * 
     * - Streak²: Makes long streaks exponentially more valuable
     *   (10-day = 100 pts, 5-day = 25 pts → 4× difference!)
     * - Accuracy: 0-100% quiz accuracy as multiplier
     * - KarmaBoost: 1.2× for 24h after lazy unlock donation
     */
    calculateScore(user: UserScore): number {
        const streakSquared = Math.pow(user.currentStreak, 2);
        const accuracyMultiplier = user.accuracy / 100;

        // Check for active Karma Boost (1.2x for 24h after donation)
        const now = Date.now();
        const hasKarmaBoost = user.karmaBoostUntil && user.karmaBoostUntil > now;
        const boostMultiplier = hasKarmaBoost ? 1.2 : 1.0;

        const rawScore = streakSquared * accuracyMultiplier * boostMultiplier;

        // Round to 1 decimal place
        return Math.round(rawScore * 10) / 10;
    }

    /**
     * Classify user into reward tier based on percentile rank
     */
    getUserTier(userRank: number, totalUsers: number): UserTier {
        if (totalUsers === 0) {
            return {
                tier: 'UNRANKED',
                name: 'Unranked',
                emoji: '🔘',
                percentile: 100,
                poolShare: 0,
            };
        }

        const percentile = (userRank / totalUsers) * 100;

        if (percentile <= REWARD_TIERS.DIAMOND_SAGE.percentile) {
            return {
                tier: 'DIAMOND_SAGE',
                name: REWARD_TIERS.DIAMOND_SAGE.name,
                emoji: REWARD_TIERS.DIAMOND_SAGE.emoji,
                percentile: percentile,
                poolShare: REWARD_TIERS.DIAMOND_SAGE.poolShare,
            };
        }

        if (percentile <= REWARD_TIERS.EMERALD_SCHOLAR.percentile) {
            return {
                tier: 'EMERALD_SCHOLAR',
                name: REWARD_TIERS.EMERALD_SCHOLAR.name,
                emoji: REWARD_TIERS.EMERALD_SCHOLAR.emoji,
                percentile: percentile,
                poolShare: REWARD_TIERS.EMERALD_SCHOLAR.poolShare,
            };
        }

        if (percentile <= REWARD_TIERS.STEEL_DISCIPLINE.percentile) {
            return {
                tier: 'STEEL_DISCIPLINE',
                name: REWARD_TIERS.STEEL_DISCIPLINE.name,
                emoji: REWARD_TIERS.STEEL_DISCIPLINE.emoji,
                percentile: percentile,
                poolShare: REWARD_TIERS.STEEL_DISCIPLINE.poolShare,
            };
        }

        return {
            tier: 'UNRANKED',
            name: 'Unranked',
            emoji: '🔘',
            percentile: percentile,
            poolShare: 0,
        };
    }

    /**
     * Calculate weekly scholarship reward for a user
     * 
     * Distribution:
     * - Diamond Sages (1%): Share 40% of pool
     * - Emerald Scholars (10%): Share 30% of pool
     * - Steel Disciplines (25%): Share 20% of pool
     * - Charity: 10% goes back to charity
     */
    async calculateWeeklyReward(
        userRank: number,
        totalUsers: number,
        tierUserCount: number,
        scholarshipPool: number,
    ): Promise<{ skrAmount: number; usdValue: number; tier: UserTier }> {
        const tier = this.getUserTier(userRank, totalUsers);

        if (tier.tier === 'UNRANKED' || tierUserCount === 0) {
            return { skrAmount: 0, usdValue: 0, tier };
        }

        // Calculate this tier's total pool share
        const tierPoolAmount = (tier.poolShare / 100) * scholarshipPool;

        // Split evenly among tier members
        const perUserAmount = tierPoolAmount / tierUserCount;

        // Use live Jupiter price for accurate USD estimate
        let skrPriceUsd = 0.001; // fallback
        try {
            const { jupiterSwap } = await import('./jupiterSwap');
            skrPriceUsd = await jupiterSwap.getSkrPriceInUsd();
        } catch {
            // Use fallback price
        }
        const usdValue = perUserAmount * skrPriceUsd;

        return {
            skrAmount: Math.round(perUserAmount),
            usdValue: Math.round(usdValue * 100) / 100,
            tier,
        };
    }

    /**
     * Calculate user's share of the reward pool
     */
    async calculateRewardShare(
        userScore: number,
        vaultBalance: number
    ): Promise<{
        sharePercent: number;
        skrAmount: number;
        usdValue: number;
    }> {
        const topScores = await this.fetchTopScores(100);
        const totalScore = topScores.reduce((sum, entry) => sum + entry.score, 0);

        if (totalScore === 0 || userScore === 0) {
            return { sharePercent: 0, skrAmount: 0, usdValue: 0 };
        }

        const sharePercent = (userScore / totalScore) * 100;
        const skrAmount = (sharePercent / 100) * vaultBalance;

        // Use live Jupiter price
        let skrPriceUsd = 0.001;
        try {
            const { jupiterSwap } = await import('./jupiterSwap');
            skrPriceUsd = await jupiterSwap.getSkrPriceInUsd();
        } catch {
            // Use fallback
        }
        const usdValue = skrAmount * skrPriceUsd;

        return { sharePercent, skrAmount, usdValue };
    }

    /**
     * Format wallet address for display
     */
    formatWallet(address: string): string {
        if (!address || address.length < 8) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    /**
     * Get epoch end time (end of current month)
     */
    getEpochEnd(): { days: number; hours: number; endDate: Date } {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const msRemaining = endOfMonth.getTime() - now.getTime();

        return {
            days: Math.floor(msRemaining / (1000 * 60 * 60 * 24)),
            hours: Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            endDate: endOfMonth,
        };
    }
}

export const leaderboardClient = new LeaderboardClient();
export default leaderboardClient;
