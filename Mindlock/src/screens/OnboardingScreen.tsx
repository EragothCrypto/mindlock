import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { typography, fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { AppIcon } from '../components/AppIcon';
import { GlowView } from '../components/ui/GlowView';
import { GridBackground } from '../components/ui/GridBackground';
import { createFadeInUpValues, staggerFadeInUp, usePressScale } from '../utils/animations';

const { width, height } = Dimensions.get('window');

interface OnboardingScreenProps {
    onComplete: () => void;
}

/**
 * Onboarding Screen
 * 
 * First-launch experience emphasizing Mindlock's unique position as
 * the FIRST Hard-Lock productivity tool on the Solana dApp Store.
 */
export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    // Stagger values for 3 feature cards
    const f1 = useRef(createFadeInUpValues()).current;
    const f2 = useRef(createFadeInUpValues()).current;
    const f3 = useRef(createFadeInUpValues()).current;

    // Press scale for CTA
    const ctaScale = useRef(new Animated.Value(1)).current;
    const { onPressIn: ctaPressIn, onPressOut: ctaPressOut } = usePressScale(ctaScale);

    useEffect(() => {
        // Hero fades in first (250ms)
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
        // Feature cards stagger in after 150ms delay
        staggerFadeInUp([f1, f2, f3], 150).start();
    }, []);

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <Animated.View
                    style={[
                        styles.heroSection,
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
                    ]}
                >
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>🔒 FIRST ON DAPP STORE</Text>
                    </View>

                    {/* Gradient title — justified: it's the hero title */}
                    <LinearGradient
                        colors={[colors.gradientStart, colors.gradientEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.heroTitleGradient}
                    >
                        <Text style={styles.heroTitle}>MINDLOCK</Text>
                    </LinearGradient>
                    <Text style={styles.heroTagline}>
                        The World's First{'\n'}
                        <Text style={styles.heroHighlight}>Hard-Lock</Text> Productivity App
                    </Text>
                </Animated.View>

                {/* Unique Value Prop */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{'>'} WHAT MAKES US DIFFERENT</Text>

                    {/* Feature cards — staggered fade-in, accent left border only (passive content) */}
                    <Animated.View style={[styles.featureCard, { opacity: f1.opacity, transform: [{ translateY: f1.translateY }] }]}>
                        <AppIcon name="warden" size={36} style={styles.featureIconImg} />
                        <View style={styles.featureContent}>
                            <Text style={styles.featureTitle}>SEED VAULT INTEGRATION</Text>
                            <Text style={styles.featureText}>
                                The only app that uses your device's Seed Vault to gate OS-level app access.
                                No workarounds. No cheating.
                            </Text>
                        </View>
                    </Animated.View>

                    <Animated.View style={[styles.featureCard, { opacity: f2.opacity, transform: [{ translateY: f2.translateY }] }]}>
                        <AppIcon name="scholarship" size={36} style={styles.featureIconImg} />
                        <View style={styles.featureContent}>
                            <Text style={styles.featureTitle}>EARN YOUR FREEDOM</Text>
                            <Text style={styles.featureText}>
                                Don't just block TikTok—EARN your way out by proving Solana knowledge.
                                Your brain is the key.
                            </Text>
                        </View>
                    </Animated.View>

                    <Animated.View style={[styles.featureCard, { opacity: f3.opacity, transform: [{ translateY: f3.translateY }] }]}>
                        <AppIcon name="charity" size={36} style={styles.featureIconImg} />
                        <View style={styles.featureContent}>
                            <Text style={styles.featureTitle}>FUEL THE ECOSYSTEM</Text>
                            <Text style={styles.featureText}>
                                Every "lazy unlock" pays $1.50 in $SKR — 100% goes to charity. You improve yourself AND fund the Seeker community.
                            </Text>
                        </View>
                    </Animated.View>
                </View>

                {/* The Stakes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{'>'} HOW IT WORKS</Text>

                    <View style={styles.stepsContainer}>
                        <View style={styles.step}>
                            <Text style={styles.stepNumber}>01</Text>
                            <Text style={styles.stepText}>TikTok opens → MINDLOCK intercepts</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.step}>
                            <Text style={styles.stepNumber}>02</Text>
                            <Text style={styles.stepText}>Answer 3 Solana questions (1 Hard)</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.step}>
                            <Text style={styles.stepNumber}>03</Text>
                            <Text style={styles.stepText}>3/3 correct → Seed Vault unlocks</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.step}>
                            <Text style={styles.stepNumber}>04</Text>
                            <Text style={styles.stepText}>1 hour access. Then prove yourself again.</Text>
                        </View>
                    </View>
                </View>

                {/* The Difference */}
                <View style={styles.comparisonSection}>
                    <Text style={styles.sectionTitle}>{'>'} NOT ANOTHER SCREEN TIME APP</Text>

                    <View style={styles.comparisonGrid}>
                        <View style={styles.comparisonOthers}>
                            <Text style={styles.comparisonLabel}>OTHER APPS</Text>
                            <Text style={styles.comparisonItem}>✗ Easy to bypass</Text>
                            <Text style={styles.comparisonItem}>✗ Just timers</Text>
                            <Text style={styles.comparisonItem}>✗ No accountability</Text>
                            <Text style={styles.comparisonItem}>✗ No value created</Text>
                        </View>
                        <View style={styles.comparisonUs}>
                            <Text style={styles.comparisonLabelUs}>MINDLOCK</Text>
                            <Text style={styles.comparisonItemUs}>✓ Seed Vault gated</Text>
                            <Text style={styles.comparisonItemUs}>✓ Knowledge proof</Text>
                            <Text style={styles.comparisonItemUs}>✓ Earn Karma rewards</Text>
                            <Text style={styles.comparisonItemUs}>✓ Fuel $SKR ecosystem</Text>
                        </View>
                    </View>
                </View>

                {/* CTA — gradient button justified as primary action */}
                <View style={styles.ctaSection}>
                    <Text style={styles.ctaText}>
                        Ready to break your addiction{'\n'}
                        while fueling the Seeker revolution?
                    </Text>

                    <GlowView color={colors.glowGreen} intensity="medium">
                        <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
                            <TouchableOpacity
                                onPressIn={ctaPressIn}
                                onPressOut={ctaPressOut}
                                onPress={onComplete}
                                activeOpacity={1}
                            >
                                <LinearGradient
                                    colors={[colors.gradientStart, colors.gradientEnd]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.ctaButton}
                                >
                                    <Text style={styles.ctaButtonText}>LOCK MY BRAIN-ROT</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    </GlowView>

                    <Text style={styles.ctaSubtext}>
                        Powered by Seed Vault • Solana Mobile • $SKR
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
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl * 2,
        paddingBottom: spacing.xl * 2,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: spacing.xl * 2,
    },
    heroTitleGradient: {
        borderRadius: 4,
        marginBottom: spacing.md,
    },
    badge: {
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginBottom: spacing.lg,
    },
    badgeText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.background,
        letterSpacing: 2,
    },
    heroTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: 48,
        color: colors.background,
        letterSpacing: 8,
        marginBottom: spacing.md,
    },
    heroTagline: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.lg,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 28,
    },
    heroHighlight: {
        color: colors.primary,
        fontFamily: fontFamilies.monoBold,
    },
    section: {
        marginBottom: spacing.xl * 1.5,
    },
    sectionTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.accent,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },
    featureCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    featureIcon: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    featureIconImg: {
        marginRight: spacing.md,
        alignSelf: 'center',
    },
    featureContent: {
        flex: 1,
    },
    featureTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    featureText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    stepsContainer: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
    },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stepNumber: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xl,
        color: colors.primary,
        width: 40,
    },
    stepText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        flex: 1,
    },
    stepLine: {
        width: 2,
        height: 20,
        backgroundColor: colors.border,
        marginLeft: 19,
        marginVertical: spacing.xs,
    },
    comparisonSection: {
        marginBottom: spacing.xl * 1.5,
    },
    comparisonGrid: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    comparisonOthers: {
        flex: 1,
        backgroundColor: colors.surface,
        padding: spacing.md,
        opacity: 0.6,
    },
    comparisonUs: {
        flex: 1,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    comparisonLabel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    },
    comparisonLabelUs: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    comparisonItem: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    comparisonItemUs: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    ctaSection: {
        alignItems: 'center',
        paddingTop: spacing.xl,
    },
    ctaText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.md,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    ctaButton: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl * 2,
        borderRadius: 6,
        marginBottom: spacing.lg,
    },
    ctaButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.background,
        letterSpacing: 2,
        textAlign: 'center',
    },
    ctaSubtext: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
});

export default OnboardingScreen;
