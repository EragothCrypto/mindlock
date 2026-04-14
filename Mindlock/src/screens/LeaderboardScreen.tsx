import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { typography, fontFamilies, fontSizes } from '../theme/typography';
import { spacing } from '../theme';
import { useUserStats, calculateLeaderboardScore } from '../hooks/useUserStats';
import { redistributionAgent, LAZY_UNLOCK_FEE_USD, FUND_SPLIT } from '../solana/redistributionAgent';
import { leaderboardClient, LeaderboardEntry, REWARD_TIERS, UserTier } from '../solana/leaderboardClient';
import { karmaTracker, KARMA_LEVELS, KarmaResult } from '../solana/karmaTracker';
import { scholarshipVault } from '../solana/scholarshipVault';
import { AppIcon, IconSizes } from '../components/AppIcon';
import { IconName } from '../assets/icons';
import { GradientCard } from '../components/ui/GradientCard';
import { GridBackground } from '../components/ui/GridBackground';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';

const { width } = Dimensions.get('window');


interface LeaderboardScreenProps {
    onBack?: () => void;
    walletAddress?: string;
}

/**
 * Leaderboard Screen
 * 
 * Displays:
 * - Total Community Scholarship fund
 * - Top users by score (Focus Forge formula)
 * - User's tier and estimated reward
 * - Karma Boost status
 * - Next epoch countdown
 */
export function LeaderboardScreen({ onBack, walletAddress }: LeaderboardScreenProps) {
    const { stats, accuracy } = useUserStats();
    const [vaultBalance, setVaultBalance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [nextEpoch, setNextEpoch] = useState({ days: 0, hours: 0 });
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [userKarma, setUserKarma] = useState<KarmaResult | null>(null);
    const [userTier, setUserTier] = useState<UserTier | null>(null);
    const [estimatedReward, setEstimatedReward] = useState({ skr: 0, usd: 0 });
    const [boostStatus, setBoostStatus] = useState({ isActive: false, remainingMs: 0 });

    // Calculate user's Focus Forge score
    const userScore = calculateLeaderboardScore(stats);

    // Load vault balance and leaderboard
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        await Promise.all([loadVaultBalance(), loadLeaderboard(), loadKarma(), loadBoostAndTier()]);
        const epoch = scholarshipVault.getEpochEnd();
        setNextEpoch({ days: epoch.days, hours: epoch.hours });
    };

    const loadKarma = async () => {
        if (walletAddress) {
            const karma = await karmaTracker.getKarma(walletAddress);
            setUserKarma(karma);
        }
    };

    const loadBoostAndTier = async () => {
        if (walletAddress) {
            // Load boost status
            const boost = await karmaTracker.getBoostStatus(walletAddress);
            setBoostStatus({ isActive: boost.isActive, remainingMs: boost.remainingMs });

            // Load tier and estimated reward
            const estimate = await scholarshipVault.estimateReward(walletAddress);
            setUserTier(estimate.tier);
            setEstimatedReward({ skr: estimate.estimatedSkr, usd: estimate.estimatedUsd });
        }
    };

    const loadLeaderboard = async () => {
        const data = await leaderboardClient.fetchTopScores(10);
        setLeaderboardData(data);
    };

    const loadVaultBalance = async () => {
        const balance = await redistributionAgent.getTotalCharityDonations();
        setVaultBalance(balance);
    };


    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const formatWallet = (address: string) => {
        if (!address) return 'Not Connected';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    // Get tier color based on tier type
    const getTierColor = (tier: string): string => {
        switch (tier) {
            case 'DIAMOND_SAGE': return '#60A5FA'; // Blue diamond
            case 'EMERALD_SCHOLAR': return '#34D399'; // Emerald green
            case 'STEEL_DISCIPLINE': return '#9CA3AF'; // Steel gray
            default: return colors.textSecondary;
        }
    };

    // Get tier icon name based on tier type
    const getTierIconName = (tier: string): IconName => {
        switch (tier) {
            case 'DIAMOND_SAGE': return 'diamond';
            case 'EMERALD_SCHOLAR': return 'emerald';
            case 'STEEL_DISCIPLINE': return 'steel';
            default: return 'diamond';
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.title}>LEADERBOARD</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Community Scholarship Vault — gradient on high-value number (justified) */}
                <View style={styles.vaultCard}>
                    <GridBackground />
                    <Text style={styles.vaultLabel}>COMMUNITY SCHOLARSHIP FUND</Text>
                    <LinearGradient
                        colors={[colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.vaultAmountGradient}
                    >
                        <AnimatedCounter
                            value={vaultBalance}
                            decimals={2}
                            suffix=" $SKR"
                            style={styles.vaultAmount}
                        />
                    </LinearGradient>
                    <Text style={styles.vaultSubtext}>
                        Funded by Lazy Unlock fees (${LAZY_UNLOCK_FEE_USD.toFixed(2)} USD in $SKR)
                    </Text>

                    <View style={styles.epochContainer}>
                        <Text style={styles.epochLabel}>NEXT DISTRIBUTION</Text>
                        <Text style={styles.epochTime}>
                            {nextEpoch.days}d {nextEpoch.hours}h
                        </Text>
                    </View>
                </View>

                {/* User Stats */}
                <View style={styles.userCard}>
                    <Text style={styles.sectionTitle}>YOUR STATS</Text>

                    {/* Karma Boost Indicator */}
                    {boostStatus.isActive && (
                        <View style={styles.boostBadge}>
                            <AppIcon name="boost" size={IconSizes.sm} />
                            <Text style={styles.boostText}>
                                KARMA BOOST ACTIVE • 1.2× Score • {karmaTracker.formatBoostRemaining(boostStatus.remainingMs)}
                            </Text>
                        </View>
                    )}

                    {/* Tier Badge */}
                    {userTier && userTier.tier !== 'UNRANKED' && (
                        <View style={[styles.tierBadge, { borderColor: getTierColor(userTier.tier) }]}>
                            <AppIcon name={getTierIconName(userTier.tier)} size={IconSizes.lg} />
                            <View style={styles.tierInfo}>
                                <Text style={[styles.tierName, { color: getTierColor(userTier.tier) }]}>
                                    {userTier.name.toUpperCase()}
                                </Text>
                                <Text style={styles.tierReward}>
                                    Est. Reward: {estimatedReward.skr} $SKR (~${estimatedReward.usd})
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Karma Badge - Heroes not slackers! 🌟 */}
                    {userKarma && (
                        <View style={[styles.karmaBadge, { backgroundColor: userKarma.color + '20' }]}>
                            <Text style={styles.karmaEmoji}>{userKarma.emoji}</Text>
                            <View style={styles.karmaInfo}>
                                <Text style={[styles.karmaLevel, { color: userKarma.color }]}>
                                    {userKarma.level.toUpperCase()}
                                </Text>
                                <Text style={styles.karmaScore}>
                                    {userKarma.totalKarma} Karma • {userKarma.donationCount} donations
                                </Text>
                            </View>
                            <View style={[styles.karmaProgress, { width: `${userKarma.progressToNext}%`, backgroundColor: userKarma.color }]} />
                        </View>
                    )}

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{accuracy.toFixed(1)}%</Text>
                            <Text style={styles.statLabel}>ACCURACY</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{stats.longestStreak}</Text>
                            <Text style={styles.statLabel}>BEST STREAK</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{stats.earnedUnlocks}</Text>
                            <Text style={styles.statLabel}>EARNED</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{userScore.toFixed(1)}</Text>
                            <Text style={styles.statLabel}>SCORE</Text>
                        </View>
                    </View>
                </View>

                {/* Leaderboard Table */}
                <View style={styles.leaderboardCard}>
                    <Text style={styles.sectionTitle}>TOP SCHOLARS</Text>

                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableCell, styles.rankCell]}>#</Text>
                        <Text style={[styles.tableCell, styles.walletCell]}>WALLET</Text>
                        <Text style={[styles.tableCell, styles.scoreCell]}>SCORE</Text>
                        <View style={styles.streakCell}><AppIcon name="fire" size={IconSizes.sm} /></View>
                    </View>

                    {/* Table Rows — top-3 get rank-color left border */}
                    {leaderboardData.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateTitle}>🏁 Be the First!</Text>
                            <Text style={styles.emptyStateText}>
                                The leaderboard goes live when the Anchor program deploys.{'\n'}
                                Your streak is already being tracked locally.
                            </Text>
                        </View>
                    ) : leaderboardData.map((entry: LeaderboardEntry) => {
                        const rankColor = entry.rank === 1 ? '#FFD700' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : null;
                        return (
                            <View
                                key={entry.rank}
                                style={[
                                    styles.tableRow,
                                    rankColor ? { borderLeftWidth: 3, borderLeftColor: rankColor } : null,
                                ]}
                            >
                                <Text style={[styles.tableCell, styles.rankCell]}>
                                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                                </Text>
                                <Text style={[styles.tableCell, styles.walletCell]}>{entry.wallet}</Text>
                                <Text style={[styles.tableCell, styles.scoreCell]}>{entry.score.toFixed(1)}</Text>
                                <Text style={[styles.tableCell, styles.streakCell]}>{entry.streak}</Text>
                            </View>
                        );
                    })}

                    {/* Separator */}
                    <View style={styles.separator}>
                        <Text style={styles.separatorText}>• • •</Text>
                    </View>

                    {/* User's Row — GradientCard border (active/selected element) */}
                    <GradientCard
                        borderColors={[colors.gradientStart, colors.gradientEnd]}
                        borderWidth={1}
                        borderRadius={4}
                        style={styles.userRowGradient}
                    >
                        <View style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.rankCell]}>?</Text>
                            <Text style={[styles.tableCell, styles.walletCell, styles.userWallet]}>
                                {formatWallet(walletAddress || '')} (YOU)
                            </Text>
                            <Text style={[styles.tableCell, styles.scoreCell]}>{userScore.toFixed(1)}</Text>
                            <Text style={[styles.tableCell, styles.streakCell]}>{stats.longestStreak}</Text>
                        </View>
                    </GradientCard>
                </View>

                {/* Info Section */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>FOCUS FORGE REWARDS</Text>
                    <Text style={styles.infoText}>
                        • Score = Streak² × Accuracy{'\n'}
                        • 💎 Top 1% = 40% • 💚 Top 10% = 30% • ⚔️ Top 25% = 20%{'\n'}
                        • Distribution every Sunday 00:00 UTC{'\n'}
                        • Lazy Unlock = 40% Charity + 60% Scholarship{'\n'}
                        • ⚡ Donation gives 1.2x boost for 24h!
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
    },
    backText: {
        fontSize: fontSizes['2xl'],
        color: colors.primary,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
        letterSpacing: 3,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    vaultCard: {
        overflow: 'hidden',
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    vaultAmountGradient: {
        borderRadius: 4,
        paddingHorizontal: spacing.sm,
        marginVertical: spacing.sm,
    },
    vaultLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.primary,
        letterSpacing: 2,
        marginBottom: spacing.sm,
    },
    vaultAmount: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['3xl'],
        color: colors.background,
        marginBottom: spacing.xs,
    },
    vaultSubtext: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    epochContainer: {
        marginTop: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    epochLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.accent,
        letterSpacing: 1,
    },
    epochTime: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.accent,
    },
    userCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statBox: {
        flex: 1,
        minWidth: (width - spacing.lg * 2 - spacing.sm * 3) / 4,
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
        alignItems: 'center',
    },
    statValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
    },
    statLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    leaderboardCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: spacing.sm,
        marginBottom: spacing.sm,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    topThreeRow: {
        backgroundColor: 'rgba(0, 255, 65, 0.05)',
    },
    userRow: {
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
    },
    userRowGradient: {
        marginBottom: spacing.xs,
    },
    tableCell: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    rankCell: {
        width: 32,
        textAlign: 'center',
    },
    walletCell: {
        flex: 1,
    },
    userWallet: {
        color: colors.accent,
    },
    scoreCell: {
        width: 48,
        textAlign: 'right',
        color: colors.primary,
    },
    streakCell: {
        width: 36,
        textAlign: 'right',
    },
    separator: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    separatorText: {
        color: colors.textMuted,
    },
    infoCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    infoTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.accent,
        letterSpacing: 1,
        marginBottom: spacing.md,
    },
    infoText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    // Karma Badge Styles 🌟
    karmaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    karmaEmoji: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    karmaInfo: {
        flex: 1,
    },
    karmaLevel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        letterSpacing: 2,
    },
    karmaScore: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    karmaProgress: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
    },
    // Karma Boost Badge ⚡
    boostBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F59E0B33',
        borderWidth: 1,
        borderColor: '#F59E0B',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    boostText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: '#F59E0B',
        letterSpacing: 1,
    },
    // Tier Badge 💎💚⚔️
    tierBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 2,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
    },
    tierEmoji: {
        fontSize: 36,
        marginRight: spacing.md,
    },
    tierInfo: {
        flex: 1,
    },
    tierName: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        letterSpacing: 2,
    },
    tierReward: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        marginTop: 4,
    },
    emptyState: {
        paddingVertical: spacing.xl,
        alignItems: 'center',
    },
    emptyStateTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.textPrimary,
        marginBottom: spacing.sm,
        letterSpacing: 1,
    },
    emptyStateText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default LeaderboardScreen;
