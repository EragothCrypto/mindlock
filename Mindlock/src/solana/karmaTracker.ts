import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// KARMA TRACKER - "Lazy Donors" become heroes!
// ============================================================================

const KARMA_STORAGE_KEY = '@mindlock_karma_';
const KARMA_BOOST_KEY = '@mindlock_karma_boost_';

// Karma Boost duration: 24 hours in milliseconds
const KARMA_BOOST_DURATION_MS = 24 * 60 * 60 * 1000;
const KARMA_BOOST_MULTIPLIER = 1.2;

/**
 * Karma Level Tiers
 * 
 * Visual evolution as donations grow.
 * Makes users feel like heroes, not slackers!
 */
export const KARMA_LEVELS = [
    { name: 'Newcomer', emoji: '🌱', minKarma: 0, color: '#888888' },
    { name: 'Supporter', emoji: '💚', minKarma: 5, color: '#4ADE80' },
    { name: 'Guardian', emoji: '🛡️', minKarma: 25, color: '#22C55E' },
    { name: 'Champion', emoji: '⭐', minKarma: 100, color: '#FBBF24' },
    { name: 'Hero', emoji: '🦸', minKarma: 500, color: '#F59E0B' },
    { name: 'Legend', emoji: '👑', minKarma: 2000, color: '#8B5CF6' },
    { name: 'Saint', emoji: '😇', minKarma: 10000, color: '#EC4899' },
];

interface KarmaData {
    totalDonatedSkr: number;
    totalDonatedUsd: number;
    donationCount: number;
    lastDonation: number;
    firstDonation: number;
}

interface KarmaBoostData {
    expiresAt: number; // Timestamp when boost expires
}

export interface KarmaResult {
    totalKarma: number;
    level: string;
    emoji: string;
    color: string;
    nextLevel: string | null;
    progressToNext: number;
    donationCount: number;
    // Karma Boost fields
    hasActiveBoost: boolean;
    boostExpiresAt: number | null;
    boostMultiplier: number;
}

/**
 * Karma Tracker
 * 
 * Tracks user donations and calculates Karma score.
 * Higher donations = higher Karma = better leaderboard badge!
 */
class KarmaTracker {
    /**
     * Get Karma level for a given score
     */
    getLevel(karma: number): { name: string; emoji: string; color: string } {
        let level = KARMA_LEVELS[0];
        for (const l of KARMA_LEVELS) {
            if (karma >= l.minKarma) {
                level = l;
            }
        }
        return level;
    }

    /**
     * Get next level info
     */
    getNextLevel(karma: number): { name: string; minKarma: number } | null {
        for (const l of KARMA_LEVELS) {
            if (karma < l.minKarma) {
                return { name: l.name, minKarma: l.minKarma };
            }
        }
        return null; // Already at max level
    }

    /**
     * Calculate Karma score from USD donations
     * 1 Karma = $1 donated
     */
    calculateKarma(totalDonatedUsd: number): number {
        return Math.floor(totalDonatedUsd);
    }

    /**
     * Add a donation and update Karma
     */
    async addDonation(
        walletAddress: string,
        skrAmount: number,
        usdValue: number
    ): Promise<KarmaResult> {
        const key = KARMA_STORAGE_KEY + walletAddress;

        // Get existing data
        let data: KarmaData = {
            totalDonatedSkr: 0,
            totalDonatedUsd: 0,
            donationCount: 0,
            lastDonation: 0,
            firstDonation: 0,
        };

        try {
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                data = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to read karma data:', e);
        }

        // Update with new donation
        const now = Date.now();
        data.totalDonatedSkr += skrAmount;
        data.totalDonatedUsd += usdValue;
        data.donationCount += 1;
        data.lastDonation = now;
        if (!data.firstDonation) {
            data.firstDonation = now;
        }

        // Save
        try {
            await AsyncStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save karma data:', e);
        }

        return this.getKarmaResult(data);
    }

    /**
     * Get Karma result from data
     */
    private getKarmaResult(data: KarmaData): KarmaResult {
        const totalKarma = this.calculateKarma(data.totalDonatedUsd);
        const level = this.getLevel(totalKarma);
        const nextLevel = this.getNextLevel(totalKarma);

        let progressToNext = 100;
        if (nextLevel) {
            const currentLevelMin = level.name === 'Newcomer' ? 0 :
                KARMA_LEVELS.find(l => l.name === level.name)?.minKarma || 0;
            const range = nextLevel.minKarma - currentLevelMin;
            const progress = totalKarma - currentLevelMin;
            progressToNext = Math.min(100, Math.floor((progress / range) * 100));
        }

        return {
            totalKarma,
            level: level.name,
            emoji: level.emoji,
            color: level.color,
            nextLevel: nextLevel?.name || null,
            progressToNext,
            donationCount: data.donationCount,
            hasActiveBoost: false,
            boostExpiresAt: null,
            boostMultiplier: 1.0,
        };
    }

    /**
     * Get user's Karma stats
     */
    async getKarma(walletAddress: string): Promise<KarmaResult> {
        const key = KARMA_STORAGE_KEY + walletAddress;

        try {
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const data: KarmaData = JSON.parse(stored);
                return this.getKarmaResult(data);
            }
        } catch (e) {
            console.error('Failed to read karma:', e);
        }

        // No karma yet
        return {
            totalKarma: 0,
            level: 'Newcomer',
            emoji: '🌱',
            color: '#888888',
            nextLevel: 'Supporter',
            progressToNext: 0,
            donationCount: 0,
            hasActiveBoost: false,
            boostExpiresAt: null,
            boostMultiplier: 1.0,
        };
    }

    /**
     * Format Karma for display
     */
    formatKarma(karma: number): string {
        if (karma >= 10000) {
            return (karma / 1000).toFixed(1) + 'K';
        }
        return karma.toString();
    }

    /**
     * Get badge component props for a user
     */
    getBadgeProps(karma: KarmaResult): {
        text: string;
        backgroundColor: string;
        emoji: string;
    } {
        return {
            text: `${karma.emoji} ${karma.level}`,
            backgroundColor: karma.color,
            emoji: karma.emoji,
        };
    }

    // ========================================================================
    // KARMA BOOST METHODS
    // ========================================================================

    /**
     * Activate Karma Boost for 24 hours
     * 
     * Called after a Lazy Unlock donation.
     * Gives user 1.2× Focus Score multiplier!
     */
    async activateBoost(walletAddress: string): Promise<{
        activated: boolean;
        expiresAt: number;
        multiplier: number;
    }> {
        const key = KARMA_BOOST_KEY + walletAddress;
        const expiresAt = Date.now() + KARMA_BOOST_DURATION_MS;

        const boostData: KarmaBoostData = {
            expiresAt,
        };

        try {
            await AsyncStorage.setItem(key, JSON.stringify(boostData));
            __DEV__ && console.log(`⚡ Karma Boost activated! 1.2× for 24h`);
            return {
                activated: true,
                expiresAt,
                multiplier: KARMA_BOOST_MULTIPLIER,
            };
        } catch (e) {
            console.error('Failed to activate boost:', e);
            return {
                activated: false,
                expiresAt: 0,
                multiplier: 1.0,
            };
        }
    }

    /**
     * Check if user has active Karma Boost
     */
    async hasActiveBoost(walletAddress: string): Promise<boolean> {
        const status = await this.getBoostStatus(walletAddress);
        return status.isActive;
    }

    /**
     * Get full boost status for UI display
     */
    async getBoostStatus(walletAddress: string): Promise<{
        isActive: boolean;
        expiresAt: number | null;
        remainingMs: number;
        multiplier: number;
    }> {
        const key = KARMA_BOOST_KEY + walletAddress;

        try {
            const stored = await AsyncStorage.getItem(key);
            if (stored) {
                const data: KarmaBoostData = JSON.parse(stored);
                const now = Date.now();

                if (data.expiresAt > now) {
                    return {
                        isActive: true,
                        expiresAt: data.expiresAt,
                        remainingMs: data.expiresAt - now,
                        multiplier: KARMA_BOOST_MULTIPLIER,
                    };
                }
            }
        } catch (e) {
            console.error('Failed to read boost status:', e);
        }

        return {
            isActive: false,
            expiresAt: null,
            remainingMs: 0,
            multiplier: 1.0,
        };
    }

    /**
     * Get boost expiry time in a readable format
     */
    formatBoostRemaining(remainingMs: number): string {
        const hours = Math.floor(remainingMs / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }
}

export const karmaTracker = new KarmaTracker();
export default karmaTracker;
