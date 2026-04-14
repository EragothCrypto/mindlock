import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STATS_KEY = 'mindlock_user_stats';

export interface UserStats {
    totalQuizzes: number;
    correctAnswers: number;
    totalQuestions: number;
    currentStreak: number;
    longestStreak: number;
    lastQuizDate: string | null;
    lazyUnlocks: number;
    earnedUnlocks: number;
}

const DEFAULT_STATS: UserStats = {
    totalQuizzes: 0,
    correctAnswers: 0,
    totalQuestions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastQuizDate: null,
    lazyUnlocks: 0,
    earnedUnlocks: 0,
};

interface UseUserStatsResult {
    stats: UserStats;
    accuracy: number;
    isLoading: boolean;
    recordQuizResult: (correct: number, total: number) => Promise<void>;
    recordLazyUnlock: () => Promise<void>;
    resetStats: () => Promise<void>;
}

/**
 * useUserStats Hook
 * 
 * Tracks user quiz performance for leaderboard:
 * - Accuracy percentage
 * - Streak count
 * - Earned vs Lazy unlocks
 */
export function useUserStats(): UseUserStatsResult {
    const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
    const [isLoading, setIsLoading] = useState(true);

    // Load stats on mount
    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const stored = await AsyncStorage.getItem(STATS_KEY);
            if (stored) {
                setStats(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveStats = async (newStats: UserStats) => {
        try {
            await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
            setStats(newStats);
        } catch (error) {
            console.error('Failed to save stats:', error);
        }
    };

    /**
     * Record quiz result
     * Note: During Day Pass, streak is frozen (not modified)
     */
    const recordQuizResult = useCallback(async (correct: number, total: number) => {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if streak is frozen (Day Pass active)
        let isStreakFrozen = false;
        try {
            const { NativeModules, Platform } = require('react-native');
            if (Platform.OS === 'android' && NativeModules.DayPassModule) {
                isStreakFrozen = await NativeModules.DayPassModule.isStreakFrozen();
            }
        } catch (e) {
            // Native module not available
        }

        let newStreak = stats.currentStreak;

        // Only modify streak if NOT frozen
        if (!isStreakFrozen) {
            // Check streak
            if (stats.lastQuizDate === yesterday) {
                // Consecutive day - increment streak
                newStreak = stats.currentStreak + 1;
            } else if (stats.lastQuizDate !== today) {
                // Streak broken - reset
                newStreak = 1;
            }
            // Same day - keep current streak
        }
        // If frozen, streak stays frozen (🧊)

        const newStats: UserStats = {
            ...stats,
            totalQuizzes: stats.totalQuizzes + 1,
            correctAnswers: stats.correctAnswers + correct,
            totalQuestions: stats.totalQuestions + total,
            currentStreak: newStreak,
            longestStreak: Math.max(stats.longestStreak, newStreak),
            lastQuizDate: isStreakFrozen ? stats.lastQuizDate : today, // Don't update date if frozen
            earnedUnlocks: correct === total ? stats.earnedUnlocks + 1 : stats.earnedUnlocks,
        };

        await saveStats(newStats);
    }, [stats]);

    /**
     * Record lazy unlock (paid skip)
     */
    const recordLazyUnlock = useCallback(async () => {
        const newStats: UserStats = {
            ...stats,
            lazyUnlocks: stats.lazyUnlocks + 1,
        };
        await saveStats(newStats);
    }, [stats]);

    /**
     * Reset all stats
     */
    const resetStats = useCallback(async () => {
        await saveStats(DEFAULT_STATS);
    }, []);

    // Calculate accuracy
    const accuracy = stats.totalQuestions > 0
        ? (stats.correctAnswers / stats.totalQuestions) * 100
        : 0;

    return {
        stats,
        accuracy,
        isLoading,
        recordQuizResult,
        recordLazyUnlock,
        resetStats,
    };
}

/**
 * Calculate leaderboard score
 * Formula: (accuracy * 0.5) + (streak_bonus * 0.5)
 */
export function calculateLeaderboardScore(stats: UserStats): number {
    const accuracy = stats.totalQuestions > 0
        ? (stats.correctAnswers / stats.totalQuestions) * 100
        : 0;

    // Streak bonus: max 100 at 30 days
    const streakBonus = Math.min((stats.longestStreak / 30) * 100, 100);

    return (accuracy * 0.5) + (streakBonus * 0.5);
}

export default useUserStats;
