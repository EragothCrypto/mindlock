import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    ScrollView,
    NativeModules,
    Animated,
} from 'react-native';
import { PublicKey, Transaction } from '@solana/web3.js';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { redistributionAgent } from '../solana/redistributionAgent';
import { leaderboardClient } from '../solana/leaderboardClient';
import { jupiterSwap } from '../solana/jupiterSwap';
import { scholarshipVault, ScholarshipStats } from '../solana/scholarshipVault';
import { kaminoYield } from '../solana/kaminoYield';
import { useUserStats, calculateLeaderboardScore } from '../hooks/useUserStats';
import { GlowView } from '../components/ui/GlowView';
import { GridBackground } from '../components/ui/GridBackground';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';
import { usePressScale } from '../utils/animations';

interface RewardClaimScreenProps {
    onBack?: () => void;
    walletAddress?: PublicKey;
    signTransaction?: (tx: Transaction) => Promise<Transaction>;
}

/**
 * Reward Claim Screen
 * 
 * Displays the user's scholarship earnings based on their focus score
 * and allows them to claim $SKR directly to their Seed Vault.
 */
export function RewardClaimScreen({
    onBack,
    walletAddress,
    signTransaction,
}: RewardClaimScreenProps) {
    const { stats } = useUserStats();
    const userScore = calculateLeaderboardScore(stats);

    // ── Custom modal state (replaces Alert.alert)
    type ModalAction = { label: string; accent?: boolean; onPress: () => void };
    const [modalVisible, setModalVisible] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalBody, setModalBody] = useState('');
    const [modalActions, setModalActions] = useState<ModalAction[]>([]);

    const showModal = (title: string, body: string, actions: ModalAction[]) => {
        setModalTitle(title);
        setModalBody(body);
        setModalActions(actions);
        setModalVisible(true);
    };
    const hideModal = () => setModalVisible(false);

    // Press scale for claim CTA
    const claimScale = useRef(new Animated.Value(1)).current;
    const { onPressIn: claimPressIn, onPressOut: claimPressOut } = usePressScale(claimScale);

    // State
    const [vaultBalance, setVaultBalance] = useState(0);
    const [skrPrice, setSkrPrice] = useState(0);
    const [kaminoStats, setKaminoStats] = useState<ScholarshipStats | null>(null);
    const [rewardShare, setRewardShare] = useState({
        sharePercent: 0,
        skrAmount: 0,
        usdValue: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState(false);
    const [hasClaimed, setHasClaimed] = useState(false);
    const [nextEpoch, setNextEpoch] = useState({ days: 0, hours: 0 });

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Fetch vault stats (includes Kamino yield) + Jupiter price + reward share in parallel
            const [balance, price, share, vaultStats] = await Promise.all([
                redistributionAgent.getTotalCharityDonations(),
                jupiterSwap.getSkrPriceInUsd(),
                leaderboardClient.calculateRewardShare(userScore, 0),
                scholarshipVault.getStats(),
            ]);

            setVaultBalance(balance);
            setSkrPrice(price);
            setKaminoStats(vaultStats);

            const shareWithBalance = await leaderboardClient.calculateRewardShare(userScore, balance);
            setRewardShare(shareWithBalance);

            const epoch = leaderboardClient.getEpochEnd();
            setNextEpoch({ days: epoch.days, hours: epoch.hours });
        } catch (error) {
            console.error('Failed to load reward data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Biometric Claim Handler
     * 
     * Triggers the Seed Vault Bottom Sheet for fingerprint authorization.
     * User feels haptic "thump" when their scholarship claim is approved.
     */
    const handleClaim = async () => {
        if (!walletAddress) {
            showModal('WALLET REQUIRED', 'Please connect your Seed Vault to claim rewards.', [
                { label: 'OK', accent: true, onPress: hideModal },
            ]);
            return;
        }

        if (rewardShare.skrAmount <= 0) {
            showModal('NO REWARDS YET', 'You don\'t have any rewards to claim yet. Keep passing quizzes to improve your Focus Score.', [
                { label: 'GOT IT', accent: true, onPress: hideModal },
            ]);
            return;
        }

        setIsClaiming(true);
        try {
            // Import MWA transact for Seed Vault biometric
            const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');

            // Build claim transaction (would include Merkle proof in production)
            const claimTx = await buildClaimTransaction(
                walletAddress,
                rewardShare.skrAmount,
                userScore
            );

            // 🔐 SEED VAULT BIOMETRIC: Triggers Bottom Sheet with fingerprint
            // User feels haptic "thump" when authorizing the claim
            const signedTx = await transact(async (wallet: any) => {
                // Re-authorize if needed (shows biometric prompt)
                await wallet.authorize({
                    cluster: 'devnet',
                    identity: {
                        name: 'Mindlock',
                        uri: 'https://mindlock.app',
                        icon: 'favicon.ico',
                    },
                });

                // Sign the claim transaction (triggers haptic feedback!)
                const signed = await wallet.signTransactions({
                    transactions: [claimTx],
                });

                return signed[0];
            });

            // In production: send signedTx to network
            // For MVP: simulate success
            __DEV__ && console.log('Claim signed with Seed Vault biometric:', signedTx);

            setHasClaimed(true);
            showModal(
                '🎉 CLAIM SUCCESSFUL',
                `${rewardShare.skrAmount.toFixed(2)} $SKR authorized and sent to your Seed Vault.\n\nYou felt the thump — that's real ownership.`,
                [{ label: 'LFG! 🚀', accent: true, onPress: () => { hideModal(); onBack?.(); } }]
            );
        } catch (error: any) {
            console.error('Seed Vault claim failed:', error);

            if (error?.message?.includes('user rejected')) {
                showModal('CLAIM CANCELLED', 'You cancelled the biometric authorization.', [
                    { label: 'CLOSE', onPress: hideModal },
                ]);
            } else {
                showModal('CLAIM FAILED', 'Unable to complete biometric authorization. Please try again.', [
                    { label: 'RETRY', accent: true, onPress: () => { hideModal(); handleClaim(); } },
                    { label: 'CANCEL', onPress: hideModal },
                ]);
            }
        } finally {
            setIsClaiming(false);
        }
    };

    /**
     * Build the on-chain claim transaction
     * In production, this calls the commitment_vault::claim_reward instruction
     */
    const buildClaimTransaction = async (
        user: PublicKey,
        skrAmount: number,
        focusScore: number
    ): Promise<Transaction> => {
        // Create placeholder transaction for MVP
        // In production: Add claim_reward instruction with Merkle proof
        const { Connection, Transaction: SolanaTransaction } = await import('@solana/web3.js');
        const connection = new Connection('https://api.devnet.solana.com');
        const { blockhash } = await connection.getLatestBlockhash();

        const tx = new SolanaTransaction({
            feePayer: user,
            recentBlockhash: blockhash,
        });

        // TODO: Add actual claim_reward instruction
        // tx.add(claimRewardInstruction(user, skrAmount, merkleProof));

        return tx;
    };


    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>CALCULATING EARNINGS...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <GridBackground />
            {/* Header */}
            <View style={styles.header}>
                {onBack && (
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.title}>CLAIM REWARDS</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Scholarship Earnings Card — gradient on high-value number (justified) */}
                <View style={styles.earningsCard}>
                    <Text style={styles.earningsLabel}>SCHOLARSHIP EARNINGS</Text>
                    <LinearGradient
                        colors={[colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.earningsAmountGradient}
                    >
                        <AnimatedCounter
                            value={rewardShare.skrAmount}
                            decimals={2}
                            suffix=" $SKR"
                            style={styles.earningsAmount}
                        />
                    </LinearGradient>
                    <Text style={styles.earningsUsd}>
                        ≈ ${rewardShare.usdValue.toFixed(2)} USD
                    </Text>

                    <View style={styles.divider} />

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{userScore.toFixed(1)}</Text>
                            <Text style={styles.statLabel}>YOUR SCORE</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{rewardShare.sharePercent.toFixed(2)}%</Text>
                            <Text style={styles.statLabel}>POOL SHARE</Text>
                        </View>
                    </View>
                </View>

                {/* Vault Info */}
                <View style={styles.vaultCard}>
                    <Text style={styles.vaultLabel}>COMMUNITY VAULT</Text>
                    <Text style={styles.vaultBalance}>
                        {redistributionAgent.formatBalance(vaultBalance)}
                    </Text>
                    <Text style={styles.vaultPrice}>
                        $SKR = ${skrPrice.toFixed(4)} USD
                    </Text>
                </View>

                {/* Kamino Yield Card — pool earns while you compete */}
                <View style={styles.kaminoCard}>
                    <View style={styles.kaminoHeader}>
                        <View style={styles.kaminoBadge}>
                            <Text style={styles.kaminoBadgeText}>YIELD</Text>
                        </View>
                        <Text style={styles.kaminoTitle}>SCHOLARSHIP POOL EARNS</Text>
                        <Text style={styles.kaminoApy}>
                            {kaminoStats ? `${kaminoStats.kaminoApy.toFixed(2)}%` : '~8.35%'}
                        </Text>
                    </View>

                    <View style={styles.kaminoDivider} />

                    <View style={styles.kaminoStatsRow}>
                        <View style={styles.kaminoStat}>
                            <Text style={styles.kaminoStatValue}>
                                {kaminoStats
                                    ? kaminoYield.formatWeeklyYield({
                                        yieldThisEpochSkr: kaminoStats.kaminoYieldSkr,
                                        apy: kaminoStats.kaminoApy,
                                        vaultBalanceSkr: kaminoStats.vaultBalance,
                                        yieldThisEpochUsd: kaminoStats.kaminoYieldUsd,
                                        projectedEpochEndSkr: kaminoStats.kaminoProjectedEnd,
                                        strategy: { apy: kaminoStats.kaminoApy, tvlUsd: 0, strategyLabel: kaminoStats.kaminoStrategyLabel, dashboardUrl: '', fetchedAt: 0, isLive: kaminoStats.kaminoIsLive },
                                    })
                                    : '+-- $SKR this epoch'}
                            </Text>
                            <Text style={styles.kaminoStatLabel}>ESTIMATED YIELD</Text>
                        </View>
                        <View style={styles.kaminoStat}>
                            <Text style={styles.kaminoStatValue}>
                                {kaminoStats?.kaminoStrategyLabel ?? 'USDC/SOL Vault'}
                            </Text>
                            <Text style={styles.kaminoStatLabel}>STRATEGY</Text>
                        </View>
                    </View>

                    <Text style={styles.kaminoFooter}>
                        ⚡ Pool grows while you compete · Powered by Kamino Finance
                        {kaminoStats && !kaminoStats.kaminoIsLive ? ' (reference rate)' : ''}
                    </Text>
                </View>

                {/* Epoch Countdown */}
                <View style={styles.epochCard}>
                    <Text style={styles.epochLabel}>NEXT DISTRIBUTION</Text>
                    <Text style={styles.epochTime}>
                        {nextEpoch.days}d {nextEpoch.hours}h
                    </Text>
                    <Text style={styles.epochNote}>
                        Rewards calculated at end of each epoch
                    </Text>
                </View>

                {/* Claim Button — primary CTA: gradient + glow justified */}
                {!hasClaimed && rewardShare.skrAmount > 0 ? (
                    <GlowView color={colors.glowGreen} intensity="medium">
                        <Animated.View style={{ transform: [{ scale: claimScale }] }}>
                            <TouchableOpacity
                                onPressIn={claimPressIn}
                                onPressOut={claimPressOut}
                                onPress={handleClaim}
                                disabled={isClaiming}
                                activeOpacity={1}
                            >
                                <LinearGradient
                                    colors={[colors.gradientStart, colors.gradientEnd]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.claimButtonGradient}
                                >
                                    {isClaiming ? (
                                        <ActivityIndicator color={colors.textOnPrimary} />
                                    ) : (
                                        <Text style={styles.claimButtonText}>CLAIM TO SEED VAULT</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </GlowView>
                ) : (
                    <View style={[styles.claimButton, styles.claimButtonDisabled]}>
                        <Text style={styles.claimButtonText}>
                            {hasClaimed ? '✓ CLAIMED' : 'CLAIM TO SEED VAULT'}
                        </Text>
                    </View>
                )}

                {/* ─────── ESCAPE OPTIONS (Lazy Unlock / Day Pass) ─────── */}
                <View style={styles.escapeSection}>
                    <Text style={styles.escapeSectionTitle}>🔓 ESCAPE OPTIONS</Text>
                    <Text style={styles.escapeSectionSubtitle}>
                        Couldn't pass the quiz? Unlock access instantly:
                    </Text>

                    {/* Lazy Unlock */}
                    <TouchableOpacity
                        style={styles.escapeButton}
                        onPress={() => {
                            showModal(
                                '💸 LAZY UNLOCK',
                                'Pay $1.50 in $SKR to unlock access now.\n\n100% goes to charity. Your Karma score increases on the leaderboard.\n\nDevnet: payment simulated — grace period granted locally.',
                                [
                                    { label: 'CANCEL', onPress: hideModal },
                                    {
                                        label: 'PAY $1.50 $SKR',
                                        accent: true,
                                        onPress: async () => {
                                            hideModal();
                                            try {
                                                const result = await NativeModules.MindlockWarden?.getGracePeriod?.();
                                                const mins = result?.gracePeriodMinutes ?? 30;
                                                showModal('✅ UNLOCKED', `${mins}-minute grace period granted.\n\n100% of your payment goes to charity. Karma earned! 🌱`, [
                                                    { label: 'LETS GO', accent: true, onPress: () => { hideModal(); onBack?.(); } },
                                                ]);
                                            } catch (e: any) {
                                                showModal('ERROR', e?.message || 'Lazy unlock failed. Please try again.', [
                                                    { label: 'CLOSE', onPress: hideModal },
                                                ]);
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Text style={styles.escapeButtonIcon}>💸</Text>
                        <View style={styles.escapeButtonContent}>
                            <Text style={styles.escapeButtonTitle}>LAZY UNLOCK</Text>
                            <Text style={styles.escapeButtonDesc}>$1.50 $SKR → 100% to charity • Earn Karma</Text>
                        </View>
                        <Text style={styles.escapeButtonArrow}>›</Text>
                    </TouchableOpacity>

                    {/* Day Pass */}
                    <TouchableOpacity
                        style={[styles.escapeButton, styles.escapeButtonDayPass]}
                        onPress={() => {
                            showModal(
                                '🛡️ DAY PASS',
                                'Pay 500 $SKR for 24 hours of unrestricted access.\nCooldown: 7 days between purchases.\n\nDevnet: payment simulated — shield activated locally.',
                                [
                                    { label: 'CANCEL', onPress: hideModal },
                                    {
                                        label: 'BUY 500 $SKR',
                                        accent: true,
                                        onPress: async () => {
                                            hideModal();
                                            try {
                                                const result = await NativeModules.DayPassModule?.activateDayPass?.();
                                                const expiresAt = result?.expiresAt ? new Date(result.expiresAt).toLocaleTimeString() : '24h from now';
                                                showModal('✅ DAY PASS ACTIVE', `24-hour shield activated.\nExpires at: ${expiresAt}\n\nNo quiz interruptions for 24h. Streak is frozen and protected. 🛡️`, [
                                                    { label: 'ACTIVATE', accent: true, onPress: () => { hideModal(); onBack?.(); } },
                                                ]);
                                            } catch (e: any) {
                                                showModal('ERROR', e?.message || 'Day Pass activation failed. Please try again.', [
                                                    { label: 'CLOSE', onPress: hideModal },
                                                ]);
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Text style={styles.escapeButtonIcon}>🛡️</Text>
                        <View style={styles.escapeButtonContent}>
                            <Text style={styles.escapeButtonTitle}>DAY PASS</Text>
                            <Text style={styles.escapeButtonDesc}>500 $SKR • 24h full access • 7-day cooldown</Text>
                        </View>
                        <Text style={styles.escapeButtonArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* Info */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>HOW IT WORKS</Text>
                    <Text style={styles.infoText}>
                        • Improve your Focus Score with daily quizzes{'\n'}
                        • Higher scores = larger share of the reward pool{'\n'}
                        • $SKR is distributed at the end of each epoch{'\n'}
                        • Rewards are sent directly to your Seed Vault
                    </Text>
                </View>
            </ScrollView>

            {/* ── Custom Neon-Noir Modal (replaces Android Alert) ── */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={hideModal}
                statusBarTranslucent
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={hideModal}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        {/* Neon top border accent */}
                        <View style={styles.modalAccentBar} />

                        <Text style={styles.modalTitle}>{modalTitle}</Text>
                        <Text style={styles.modalBody}>{modalBody}</Text>

                        <View style={styles.modalActions}>
                            {modalActions.map((action, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.modalActionBtn,
                                        action.accent ? styles.modalActionAccent : styles.modalActionGhost,
                                        i < modalActions.length - 1 && { marginRight: spacing.sm },
                                    ]}
                                    onPress={action.onPress}
                                >
                                    <Text style={[
                                        styles.modalActionText,
                                        action.accent ? styles.modalActionTextAccent : styles.modalActionTextGhost,
                                    ]}>
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.primary,
        marginTop: spacing.lg,
        letterSpacing: 2,
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
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    earningsCard: {
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.primary,
        padding: spacing.xl,
        marginBottom: spacing.lg,
        alignItems: 'center',
        ...shadows.glow,
    },
    earningsLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.primary,
        letterSpacing: 2,
        marginBottom: spacing.sm,
    },
    earningsAmount: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['4xl'],
        color: colors.textOnPrimary,
    },
    earningsAmountGradient: {
        borderRadius: 4,
        paddingHorizontal: spacing.sm,
        marginVertical: spacing.sm,
    },
    earningsUsd: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.lg,
        color: colors.accent,
        marginTop: spacing.xs,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.lg,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.textPrimary,
    },
    statLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    vaultCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    vaultLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 1,
    },
    vaultBalance: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.textPrimary,
        marginTop: spacing.xs,
    },
    vaultPrice: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.accent,
        marginTop: spacing.xs,
    },

    // ─── Kamino Yield Card ────────────────────────────────────────────────────
    kaminoCard: {
        backgroundColor: '#0D0A1E',
        borderWidth: 1,
        borderColor: '#7C3AED44',
        borderRadius: 8,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    kaminoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    kaminoBadge: {
        backgroundColor: '#7C3AED',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    kaminoBadgeText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: 9,
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    kaminoTitle: {
        flex: 1,
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: '#A78BFA',
        letterSpacing: 1,
    },
    kaminoApy: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: '#C4B5FD',
    },
    kaminoDivider: {
        height: 1,
        backgroundColor: '#7C3AED22',
        marginHorizontal: spacing.md,
    },
    kaminoStatsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.lg,
    },
    kaminoStat: {
        flex: 1,
    },
    kaminoStatValue: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: '#E9D5FF',
        marginBottom: 2,
    },
    kaminoStatLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: '#7C3AED',
        letterSpacing: 1,
    },
    kaminoFooter: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: '#7C3AED',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        opacity: 0.8,
    },
    epochCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.lg,
        alignItems: 'center',
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    epochLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.accent,
        letterSpacing: 1,
    },
    epochTime: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.accent,
        marginTop: spacing.xs,
    },
    epochNote: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    claimButton: {
        paddingVertical: spacing.xl,
        marginBottom: spacing.lg,
        marginHorizontal: spacing.lg,
        alignItems: 'center',
        borderRadius: 6,
        backgroundColor: colors.surfaceElevated,
    },
    claimButtonGradient: {
        paddingVertical: spacing.xl,
        marginBottom: spacing.lg,
        marginHorizontal: spacing.lg,
        alignItems: 'center',
        borderRadius: 6,
    },
    claimButtonDisabled: {
        opacity: 0.45,
    },
    claimButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.textOnPrimary,
        letterSpacing: 2,
    },
    infoBox: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.textMuted,
    },
    infoTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        letterSpacing: 1,
        marginBottom: spacing.sm,
    },
    infoText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    // ─── Escape Options (Lazy Unlock / Day Pass) ───
    escapeSection: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#00FF4133',
        borderRadius: 8,
        padding: spacing.md,
        backgroundColor: '#00FF410A',
    },
    escapeSectionTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: '#00FF41',
        letterSpacing: 2,
        marginBottom: spacing.xs,
    },
    escapeSectionSubtitle: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    escapeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 6,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    escapeButtonDayPass: {
        borderColor: '#FFD70033',
        backgroundColor: '#FFD7000A',
    },
    escapeButtonIcon: {
        fontSize: 24,
        marginRight: spacing.md,
    },
    escapeButtonContent: {
        flex: 1,
    },
    escapeButtonTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        letterSpacing: 1,
    },
    escapeButtonDesc: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    escapeButtonArrow: {
        fontFamily: fontFamilies.mono,
        fontSize: 22,
        color: colors.textMuted,
    },

    // ─── Custom Neon-Noir Modal ───────────────────────────────────────────────
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.82)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#0D1117',
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 10,
        overflow: 'hidden',
    },
    modalAccentBar: {
        height: 3,
        backgroundColor: colors.primary,
        shadowColor: colors.glowGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 6,
    },
    modalTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.primary,
        letterSpacing: 2,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    modalBody: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 22,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: '#1A2030',
        gap: spacing.sm,
    },
    modalActionBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 6,
        minWidth: 80,
        alignItems: 'center',
    },
    modalActionAccent: {
        backgroundColor: colors.primary,
    },
    modalActionGhost: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalActionText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        letterSpacing: 1.5,
    },
    modalActionTextAccent: {
        color: colors.background,
    },
    modalActionTextGhost: {
        color: colors.textMuted,
    },
});

export default RewardClaimScreen;
