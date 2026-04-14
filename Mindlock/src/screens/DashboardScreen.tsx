/**
 * DashboardScreen - Main Hub for Mindlock
 * 
 * Features:
 * - User stats overview (accuracy, streak, Karma)
 * - Warden status and controls
 * - Quick actions (Leaderboard, Rewards, Settings)
 * - Karma badge display
 * - Setup progress if incomplete
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    AppState,
    NativeModules,
    Animated,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { useUserStats, calculateLeaderboardScore } from '../hooks/useUserStats';
import { karmaTracker, KARMA_LEVELS } from '../solana/karmaTracker';
import { dayPassManager, DayPassStatus } from '../solana/dayPass';
import { SetupProgress } from './SetupTutorialScreen';
import { AppIcon, IconSizes } from '../components/AppIcon';
import { QuizInsightsCard } from '../components/QuizInsightsCard';
import { GlowView } from '../components/ui/GlowView';
import { GradientCard } from '../components/ui/GradientCard';
import { GridBackground } from '../components/ui/GridBackground';
import { startPulse, usePressScale } from '../utils/animations';
import { ImpactCard } from '../components/ImpactCard';

// Local interface for Karma display data
interface KarmaDisplayData {
    totalKarma: number;
    level: string;
    emoji: string;
    color: string;
    progressToNext: number;
    donationCount: number;
}

interface DashboardScreenProps {
    walletAddress?: PublicKey;
    isVerified?: boolean;
    blockedAppsCount: number;
    completedSteps: number[];
    onNavigate: (screen: string) => void;
    onDisconnect: () => void;
    onContinueSetup: () => void;
}

export function DashboardScreen({
    walletAddress,
    isVerified,
    blockedAppsCount,
    completedSteps,
    onNavigate,
    onDisconnect,
    onContinueSetup,
}: DashboardScreenProps) {
    const { stats, accuracy } = useUserStats();
    const userScore = calculateLeaderboardScore(stats);

    // Warden live stats from native
    const [wardenQuizCount, setWardenQuizCount] = useState(0);
    const [graceSecondsRemaining, setGraceSecondsRemaining] = useState(0);
    const [dayPassSecondsRemaining, setDayPassSecondsRemaining] = useState(0);
    const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dayPassTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadWardenStats = useCallback(async () => {
        try {
            const { MindlockWarden, DayPassModule } = NativeModules;
            const status = await MindlockWarden?.getStatus?.();
            if (status) {
                setWardenQuizCount(status.totalQuizzes ?? 0);
                setGraceSecondsRemaining(Math.max(0, Math.floor(status.remainingGraceSeconds ?? 0)));
            }
            // Day Pass shield remaining
            const dpStatus = await DayPassModule?.getStatus?.();
            if (dpStatus) {
                const shieldSecs = Math.max(0, Math.floor((dpStatus.shieldRemainingMs ?? 0) / 1000));
                setDayPassSecondsRemaining(shieldSecs);
            }
        } catch (e) {
            // native module may not be ready
        }
    }, []);

    // Poll warden stats on mount and every time app comes to foreground
    useEffect(() => {
        loadWardenStats();
        const sub = AppState.addEventListener('change', state => {
            if (state === 'active') loadWardenStats();
        });
        return () => sub.remove();
    }, [loadWardenStats]);

    // Live countdown timer for grace period
    useEffect(() => {
        if (graceTimerRef.current) clearInterval(graceTimerRef.current);
        if (graceSecondsRemaining > 0) {
            graceTimerRef.current = setInterval(() => {
                setGraceSecondsRemaining(s => Math.max(0, s - 1));
            }, 1000);
        }
        return () => { if (graceTimerRef.current) clearInterval(graceTimerRef.current); };
    }, [graceSecondsRemaining > 0]);

    // Live countdown timer for Day Pass shield
    useEffect(() => {
        if (dayPassTimerRef.current) clearInterval(dayPassTimerRef.current);
        if (dayPassSecondsRemaining > 0) {
            dayPassTimerRef.current = setInterval(() => {
                setDayPassSecondsRemaining(s => Math.max(0, s - 1));
            }, 1000);
        }
        return () => { if (dayPassTimerRef.current) clearInterval(dayPassTimerRef.current); };
    }, [dayPassSecondsRemaining > 0]);

    const formatGrace = (secs: number) => {
        if (secs <= 0) return 'EXPIRED';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // Karma state
    const [karmaData, setKarmaData] = useState<KarmaDisplayData | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Load Karma on mount
    useEffect(() => {
        loadKarmaData();
    }, [walletAddress]);

    const loadKarmaData = async () => {
        if (!walletAddress) return;
        try {
            const karma = await karmaTracker.getKarma(walletAddress.toBase58());
            setKarmaData(karma);
        } catch (error) {
            console.error('Failed to load karma:', error);
        }
    };

    // Boost status state
    const [boostStatus, setBoostStatus] = useState({ isActive: false, remainingMs: 0 });

    const loadBoostStatus = async () => {
        if (!walletAddress) return;
        try {
            const boost = await karmaTracker.getBoostStatus(walletAddress.toBase58());
            setBoostStatus({ isActive: boost.isActive, remainingMs: boost.remainingMs });
        } catch (error) {
            console.error('Failed to load boost status:', error);
        }
    };

    // Load boost on mount
    useEffect(() => {
        loadBoostStatus();
        loadShieldStatus();
    }, [walletAddress]);

    // Shield Mode (Day Pass) state
    const [shieldStatus, setShieldStatus] = useState<DayPassStatus | null>(null);

    const loadShieldStatus = async () => {
        try {
            const status = await dayPassManager.getStatus();
            setShieldStatus(status);
        } catch (error) {
            __DEV__ && console.log('Shield status check failed:', error);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([loadKarmaData(), loadBoostStatus(), loadShieldStatus()]);
        setRefreshing(false);
    }, [walletAddress]);

    // Get Karma level info
    const karmaLevel = karmaData
        ? KARMA_LEVELS.find(l => l.name === karmaData.level)
        : KARMA_LEVELS[0];

    // Warden breathing dot animation
    const wardenPulse = useRef(new Animated.Value(0.4)).current;
    useEffect(() => { startPulse(wardenPulse); }, []);

    // Press scale for CLAIM $SKR CTA
    const claimScale = useRef(new Animated.Value(1)).current;
    const { onPressIn: claimPressIn, onPressOut: claimPressOut } = usePressScale(claimScale);

    // Grace timer glow pulse (only when active)
    const gracePulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (graceSecondsRemaining > 0) startPulse(gracePulse);
    }, [graceSecondsRemaining > 0]);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                />
            }
        >
            <GridBackground />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* Breathing Warden dot */}
                    <Animated.View style={[styles.wardenDot, { opacity: wardenPulse }]} />
                    <Text style={styles.title}>WARDEN ACTIVE</Text>
                </View>
                {isVerified && (
                    <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>✓ SEEKER</Text>
                    </View>
                )}
            </View>

            {/* Shield Mode Banner (Day Pass Active) */}
            {shieldStatus?.isShieldActive && (
                <View style={styles.shieldBanner}>
                    <View style={styles.shieldHeader}>
                        <AppIcon name="daypass" size={IconSizes.lg} />
                        <Text style={styles.shieldTitle}>PROTOCOL PAUSED</Text>
                    </View>
                    <Text style={styles.shieldSubtitle}>EMERGENCY BREAK ACTIVE</Text>
                    <View style={styles.shieldInfo}>
                        <AppIcon name="ice" size={IconSizes.md} />
                        <Text style={styles.shieldStreakText}>Streak Frozen</Text>
                        <Text style={[
                            styles.shieldCountdown,
                            shieldStatus.isLastHour && styles.shieldCountdownRed
                        ]}>
                            {dayPassManager.formatTimeRemaining(shieldStatus.shieldRemainingMs)}
                        </Text>
                    </View>
                </View>
            )}

            {/* Karma Boost Banner */}
            {boostStatus.isActive && (
                <View style={styles.boostBanner}>
                    <AppIcon name="boost" size={IconSizes.sm} />
                    <Text style={styles.boostBannerText}>
                        KARMA BOOST ACTIVE • 1.2× Focus Score • {karmaTracker.formatBoostRemaining(boostStatus.remainingMs)}
                    </Text>
                </View>
            )}

            {/* Setup Progress Card (if incomplete) */}
            {completedSteps.length < 5 && (
                <SetupProgress
                    completedSteps={completedSteps.length}
                    totalSteps={5}
                    onContinue={onContinueSetup}
                />
            )}

            {/* User Stats Card */}
            <View style={styles.statsCard}>
                <Text style={styles.sectionTitle}>YOUR STATS</Text>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{accuracy.toFixed(0)}%</Text>
                        <Text style={styles.statLabel}>ACCURACY</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{stats.currentStreak}</Text>
                        <Text style={styles.statLabel}>STREAK 🔥</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{userScore.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>FOCUS SCORE</Text>
                    </View>
                </View>

                {/* Warden Live Stats — glow only on active timers */}
                <View style={styles.unlockStats}>
                    <View style={styles.unlockItem}>
                        <Text style={styles.unlockValue}>{wardenQuizCount}</Text>
                        <Text style={styles.unlockLabel}>QUIZZES ✓</Text>
                    </View>
                    <View style={styles.unlockItem}>
                        {graceSecondsRemaining > 0 ? (
                            <GlowView color={colors.glowGreen} intensity="subtle" style={styles.activeTimerGlow}>
                                <Animated.Text style={[styles.unlockValue, styles.graceActiveValue, { opacity: gracePulse }]}>
                                    {formatGrace(graceSecondsRemaining)}
                                </Animated.Text>
                            </GlowView>
                        ) : (
                            <Text style={styles.unlockValue}>{formatGrace(graceSecondsRemaining)}</Text>
                        )}
                        <Text style={styles.unlockLabel}>GRACE LEFT ⏱</Text>
                    </View>
                    <View style={styles.unlockItem}>
                        {dayPassSecondsRemaining > 0 ? (
                            <GlowView color={colors.glowCyan} intensity="subtle" style={styles.activeTimerGlow}>
                                <Text style={[styles.unlockValue, styles.shieldActiveValue]}>
                                    {formatGrace(dayPassSecondsRemaining)}
                                </Text>
                            </GlowView>
                        ) : (
                            <Text style={[styles.unlockValue, styles.shieldInactiveValue]}>NONE</Text>
                        )}
                        <Text style={styles.unlockLabel}>🛡️ SHIELD</Text>
                    </View>
                </View>
            </View>

            {/* Karma Badge Card — left border stripe matching tier color */}
            {karmaData && (
                <View style={[styles.karmaCard, { borderLeftColor: karmaLevel?.color || colors.primary }]}>
                    <View style={styles.karmaHeader}>
                        <Text style={styles.karmaEmoji}>{karmaLevel?.emoji}</Text>
                        <View style={styles.karmaInfo}>
                            <Text style={[styles.karmaLevel, { color: karmaLevel?.color }]}>
                                {karmaLevel?.name.toUpperCase()}
                            </Text>
                            <Text style={styles.karmaScore}>
                                {karmaData.totalKarma.toFixed(0)} KARMA
                            </Text>
                        </View>
                    </View>
                    <View style={styles.karmaProgress}>
                        <View style={styles.karmaProgressBg}>
                            <View
                                style={[
                                    styles.karmaProgressFill,
                                    {
                                        width: `${karmaData.progressToNext}%`,
                                        backgroundColor: karmaLevel?.color,
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.karmaProgressText}>
                            {karmaData.donationCount} donations
                        </Text>
                    </View>
                </View>
            )}

            {/* GoldRush Charity Impact Card — live on-chain donation data */}
            <ImpactCard />

            {/* Quick Stats Row */}
            <View style={styles.quickStats}>
                <TouchableOpacity
                    style={styles.quickStatCard}
                    onPress={() => onNavigate('app-picker')}
                >
                    <Text style={styles.quickStatValue}>{blockedAppsCount}</Text>
                    <Text style={styles.quickStatLabel}>APPS LOCKED</Text>
                    <Text style={styles.quickStatAction}>TAP TO EDIT</Text>
                </TouchableOpacity>
                <View style={styles.quickStatCard}>
                    <Text style={styles.quickStatValue}>{stats.totalQuizzes}</Text>
                    <Text style={styles.quickStatLabel}>QUIZZES</Text>
                </View>
            </View>

            {/* Quick Actions — CLAIM $SKR is primary CTA (gradient+glow), LEADERBOARD is flat */}
            <View style={styles.quickActions}>
                <TouchableOpacity
                    style={styles.actionButtonFlat}
                    onPress={() => onNavigate('leaderboard')}
                >
                    <Text style={styles.actionIcon}>🏆</Text>
                    <Text style={styles.actionText}>LEADERBOARD</Text>
                </TouchableOpacity>
                <Animated.View style={{ transform: [{ scale: claimScale }], flex: 1 }}>
                    <GlowView color={colors.glowGreen} intensity="medium">
                        <TouchableOpacity
                            onPressIn={claimPressIn}
                            onPressOut={claimPressOut}
                            onPress={() => onNavigate('rewards')}
                            activeOpacity={1}
                        >
                            <LinearGradient
                                colors={[colors.gradientStart, colors.gradientEnd]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionButtonGradient}
                            >
                                <Text style={styles.actionIconDark}>💰</Text>
                                <Text style={styles.actionTextDark}>CLAIM $SKR</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </GlowView>
                </Animated.View>
            </View>

            {/* Quiz Insights — per-topic analytics */}
            <QuizInsightsCard />

            {/* Wallet Info */}
            {walletAddress && (
                <View style={styles.walletCard}>
                    <Text style={styles.walletLabel}>CONNECTED WALLET</Text>
                    <Text style={styles.walletAddress}>
                        {walletAddress.toBase58().slice(0, 8)}...{walletAddress.toBase58().slice(-8)}
                    </Text>
                    <TouchableOpacity
                        style={styles.disconnectButton}
                        onPress={onDisconnect}
                    >
                        <Text style={styles.disconnectText}>DISCONNECT</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl * 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    wardenDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        shadowColor: colors.glowGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 4,
    },
    activeTimerGlow: {
        alignItems: 'center',
    },
    actionButtonFlat: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 6,
        marginRight: spacing.sm,
        backgroundColor: colors.surface,
    },
    actionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.md,
        borderRadius: 6,
    },
    actionIconDark: {
        fontSize: 16,
    },
    actionTextDark: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textOnPrimary,
        letterSpacing: 1.5,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        letterSpacing: 2,
    },
    verifiedBadge: {
        backgroundColor: colors.surface,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: colors.primary,
        flexShrink: 0,
        marginLeft: spacing.sm,
    },
    verifiedText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
        letterSpacing: 1,
    },
    sectionTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    statsCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.xs,
    },
    statValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    statLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    unlockStats: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xl,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    unlockItem: {
        alignItems: 'center',
    },
    unlockValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.textSecondary,
    },
    lazyValue: {
        color: colors.accent,
    },
    graceActiveValue: {
        color: colors.primary,
    },
    unlockLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    karmaCard: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 2,
    },
    karmaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    karmaEmoji: {
        fontSize: 40,
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
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    karmaProgress: {
        marginTop: spacing.sm,
    },
    karmaProgressBg: {
        height: 6,
        backgroundColor: colors.border,
        marginBottom: spacing.xs,
    },
    karmaProgressFill: {
        height: '100%',
    },
    karmaProgressText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    quickStats: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    quickStatCard: {
        flex: 1,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    quickStatValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
    },
    quickStatLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 1,
    },
    quickStatAction: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.primary,
        marginTop: spacing.xs,
    },
    quickActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    actionButton: {
        flex: 1,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        alignItems: 'center',
    },
    actionIcon: {
        fontSize: 28,
        marginBottom: spacing.sm,
    },
    actionText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        letterSpacing: 1,
    },
    walletCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    walletLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    walletAddress: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    disconnectButton: {
        borderWidth: 1,
        borderColor: colors.textMuted,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    disconnectText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 1,
    },
    // Karma Boost Banner ⚡
    boostBanner: {
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
    boostBannerText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#F59E0B',
        letterSpacing: 1,
        textAlign: 'center',
    },
    // Shield Mode (Day Pass) Amber Banner
    shieldBanner: {
        backgroundColor: '#B4540033',
        borderWidth: 2,
        borderColor: '#F59E0B',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    shieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    shieldIcon: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    shieldTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: '#F59E0B',
        letterSpacing: 2,
    },
    shieldSubtitle: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: '#F59E0B',
        letterSpacing: 1,
        opacity: 0.8,
        marginBottom: spacing.sm,
    },
    shieldInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shieldStreakIcon: {
        fontSize: 18,
        marginRight: spacing.xs,
    },
    shieldStreakText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        marginRight: spacing.md,
    },
    shieldCountdown: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: '#F59E0B',
    },
    shieldCountdownRed: {
        color: '#EF4444',
    },
    shieldActiveValue: {
        color: '#F59E0B', // gold/amber when shield is active
    },
    shieldInactiveValue: {
        color: colors.textMuted,
    },
});

export default DashboardScreen;
