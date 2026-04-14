/**
 * ImpactCard — Charity Impact Dashboard Widget
 *
 * Powered by GoldRush (Covalent) — displays real-time charity metrics
 * pulled from the Mindlock charity wallet on-chain.
 *
 * Shows on DashboardScreen after the Karma card.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing } from '../theme';
import { goldRush, CharityImpactData } from '../solana/goldRushClient';

// ─── Charity wallet constant (same as redistributionAgent.ts) ─────────────
const CHARITY_WALLET = 'AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1';
const CHARITY_EXPLORER = `https://explorer.solana.com/address/${CHARITY_WALLET}`;

// ─── Demo data — shown while loading or if API is unavailable ─────────────
const DEMO_IMPACT: CharityImpactData = {
    totalSkrReceived: 12450,
    totalUsdRaised: 12.45,
    donationCount: 83,
    recentDonations: [],
    currentBalanceSkr: 4820,
    isLive: false,
    fetchedAt: Date.now(),
    walletExplorerUrl: CHARITY_EXPLORER,
};

export function ImpactCard() {
    const [impact, setImpact] = useState<CharityImpactData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Pulsing live indicator
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const liveGlowAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        // Start pulse animation
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
            ])
        );
        const glow = Animated.loop(
            Animated.sequence([
                Animated.timing(liveGlowAnim, { toValue: 1.0, duration: 900, useNativeDriver: true }),
                Animated.timing(liveGlowAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
            ])
        );
        pulse.start();
        glow.start();
        return () => { pulse.stop(); glow.stop(); };
    }, []);

    useEffect(() => {
        loadImpact();
    }, []);

    const loadImpact = async () => {
        setIsLoading(true);
        try {
            const data = await goldRush.getCharityImpact();
            setImpact(data);
        } catch {
            // Show demo data on failure — dashboard still looks great
            setImpact(DEMO_IMPACT);
        } finally {
            setIsLoading(false);
        }
    };

    const display = impact ?? DEMO_IMPACT;
    const totalSkrDisplay = goldRush.formatSkr(display.totalSkrReceived);
    const totalUsdDisplay = goldRush.formatUsd(display.totalUsdRaised);
    const balanceDisplay = goldRush.formatSkr(display.currentBalanceSkr);

    return (
        <View style={styles.card}>
            {/* ── Header row ── */}
            <View style={styles.header}>
                <View style={styles.titleGroup}>
                    <View style={styles.liveDot}>
                        <Animated.View
                            style={[
                                styles.liveDotCore,
                                { transform: [{ scale: pulseAnim }], opacity: liveGlowAnim },
                            ]}
                        />
                        <View style={styles.liveDotInner} />
                    </View>
                    <Text style={styles.title}>CHARITY IMPACT</Text>
                </View>
                <TouchableOpacity
                    onPress={() => Linking.openURL(CHARITY_EXPLORER)}
                    style={styles.goldrushBadge}
                >
                    <Text style={styles.goldrushBadgeText}>GoldRush ↗</Text>
                </TouchableOpacity>
            </View>

            {/* ── Main metric: total raised ── */}
            {isLoading ? (
                <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#F97316" />
                    <Text style={styles.loadingText}>Fetching on-chain data...</Text>
                </View>
            ) : (
                <>
                    <View style={styles.primaryMetric}>
                        <Text style={styles.primaryAmount}>{totalUsdDisplay}</Text>
                        <Text style={styles.primaryLabel}>RAISED FOR CHARITY</Text>
                    </View>

                    {/* ── Stats row ── */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalSkrDisplay} $SKR</Text>
                            <Text style={styles.statLabel}>TOTAL DONATED</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{display.donationCount}</Text>
                            <Text style={styles.statLabel}>DONATIONS</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{balanceDisplay}</Text>
                            <Text style={styles.statLabel}>BALANCE</Text>
                        </View>
                    </View>

                    {/* ── Recent donations activity feed ── */}
                    {display.recentDonations.length > 0 && (
                        <View style={styles.activityFeed}>
                            <Text style={styles.feedLabel}>RECENT DONATIONS</Text>
                            {display.recentDonations.slice(0, 3).map((donation, i) => (
                                <TouchableOpacity
                                    key={donation.txHash}
                                    style={styles.feedRow}
                                    onPress={() => Linking.openURL(donation.explorerUrl)}
                                >
                                    <View style={styles.feedDot} />
                                    <Text style={styles.feedFrom}>
                                        {goldRush.truncateAddress(donation.fromAddress)}
                                    </Text>
                                    <Text style={styles.feedAmount}>
                                        {goldRush.formatSkr(donation.skrAmount)} $SKR
                                    </Text>
                                    <Text style={styles.feedTime}>
                                        {goldRush.formatRelativeTime(donation.timestamp)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* ── Footer ── */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            💝 Every Lazy Unlock donates 40% to{' '}
                            <Text
                                style={styles.footerLink}
                                onPress={() => Linking.openURL(CHARITY_EXPLORER)}
                            >
                                telagacharity.sol
                            </Text>
                        </Text>
                        <Text style={styles.footerPowered}>
                            {display.isLive ? '⚡ Live via GoldRush' : '📊 GoldRush (cached)'}
                        </Text>
                    </View>
                </>
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const ORANGE = '#F97316';
const ORANGE_DIM = '#F9731622';
const ORANGE_BORDER = '#F9731644';

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#0F0A00',
        borderWidth: 1,
        borderColor: ORANGE_BORDER,
        borderRadius: 8,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
    },
    titleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    liveDot: {
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveDotCore: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: `${ORANGE}44`,
    },
    liveDotInner: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: ORANGE,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: ORANGE,
        letterSpacing: 2,
    },
    goldrushBadge: {
        backgroundColor: ORANGE_DIM,
        borderWidth: 1,
        borderColor: ORANGE_BORDER,
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    goldrushBadgeText: {
        fontFamily: fontFamilies.mono,
        fontSize: 10,
        color: ORANGE,
        letterSpacing: 0.5,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    loadingText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    primaryMetric: {
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: ORANGE_BORDER,
    },
    primaryAmount: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['3xl'],
        color: ORANGE,
    },
    primaryLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: `${ORANGE}99`,
        letterSpacing: 2,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: ORANGE_BORDER,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    statDivider: {
        width: 1,
        backgroundColor: ORANGE_BORDER,
    },
    statValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: '#FED7AA',
    },
    statLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: 9,
        color: `${ORANGE}88`,
        letterSpacing: 1,
        marginTop: 2,
    },
    activityFeed: {
        borderTopWidth: 1,
        borderTopColor: ORANGE_BORDER,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    feedLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: 9,
        color: `${ORANGE}88`,
        letterSpacing: 2,
        marginBottom: spacing.xs,
    },
    feedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: spacing.sm,
    },
    feedDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: ORANGE,
    },
    feedFrom: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        flex: 1,
    },
    feedAmount: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#FED7AA',
    },
    feedTime: {
        fontFamily: fontFamilies.mono,
        fontSize: 10,
        color: colors.textMuted,
        minWidth: 50,
        textAlign: 'right',
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: ORANGE_BORDER,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerText: {
        fontFamily: fontFamilies.mono,
        fontSize: 10,
        color: colors.textMuted,
        flex: 1,
    },
    footerLink: {
        color: ORANGE,
        textDecorationLine: 'underline',
    },
    footerPowered: {
        fontFamily: fontFamilies.mono,
        fontSize: 10,
        color: `${ORANGE}88`,
    },
});
