/**
 * SetupTutorialScreen - Interactive First-Time Setup
 * 
 * Step-by-step guide for first-time users:
 * 1. Connect wallet
 * 2. Select apps to block
 * 3. Grant permissions
 * 4. Start the Warden
 * 
 * Clean, authentic, and easy to follow.
 */

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Animated,
    ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { AppIcon } from '../components/AppIcon';
import { GlowView } from '../components/ui/GlowView';
import { GridBackground } from '../components/ui/GridBackground';
import { usePressScale } from '../utils/animations';
import type { IconName } from '../assets/icons';

const { width } = Dimensions.get('window');

interface TutorialStep {
    id: number;
    icon: string;       // emoji fallback
    iconName?: IconName; // custom icon if available
    title: string;
    description: string;
    action: string;
    tip?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 1,
        icon: '🔗',
        iconName: 'wallet',
        title: 'CONNECT YOUR WALLET',
        description: 'Link your Solana wallet to activate the Warden. This enables staking and verifies your Seeker status.',
        action: 'CONNECT WALLET',
        tip: 'Seeker owners get bonus unlock time!',
    },
    {
        id: 2,
        icon: '📱',
        iconName: 'warden',
        title: 'SELECT APPS TO LOCK',
        description: 'Choose which "Brain-Rot" apps you want to block. TikTok, Instagram, and YouTube are pre-selected.',
        action: 'SELECT APPS',
        tip: 'You can always change this later.',
    },
    {
        id: 3,
        icon: '🔐',
        iconName: 'verified',
        title: 'GRANT PERMISSIONS',
        description: 'Two permissions are required:\n\n① Usage Access — detects when a blocked app opens\n② Display Over Other Apps — shows the quiz on top of blocked apps\n\nBoth are required for the Warden to work.',
        action: 'GRANT ACCESS',
        tip: 'Your data stays on-device. No tracking.',
    },
    {
        id: 4,
        icon: '💝',
        iconName: 'charity' as const,
        title: 'CHARITY & KARMA',
        description: 'Too lazy to answer? Pay $1.50 in $SKR to skip – but here\'s the twist: 100% goes to CHARITY! You earn Karma that shows on the leaderboard.',
        action: 'GOT IT',
        tip: 'Higher Karma = Saint status on leaderboard!',
    },
    {
        id: 5,
        icon: '⚡',
        iconName: 'boost' as const,
        title: 'ACTIVATE THE WARDEN',
        description: 'Start the background service. When you try to open a blocked app, you\'ll need to pass the quiz first.',
        action: 'ACTIVATE',
        tip: 'Answer 3 questions, 1 must be Hard.',
    },
];

interface SetupTutorialScreenProps {
    currentStep: number;
    onStepAction: (step: number) => void;
    onSkip: () => void;
    completedSteps: number[];
}

export function SetupTutorialScreen({
    currentStep,
    onStepAction,
    onSkip,
    completedSteps,
}: SetupTutorialScreenProps) {
    const step = TUTORIAL_STEPS[currentStep - 1] || TUTORIAL_STEPS[0];

    // Press scale for primary action button
    const btnScale = useRef(new Animated.Value(1)).current;
    const { onPressIn: btnPressIn, onPressOut: btnPressOut } = usePressScale(btnScale);

    return (
        <View style={styles.container}>
            <GridBackground />
            {/* Progress dots — only the ACTIVE dot glows (design rule) */}
            <View style={styles.progressContainer}>
                {TUTORIAL_STEPS.map((s, index) => {
                    const isActive = index === currentStep - 1;
                    const isDone = index < currentStep - 1;
                    const dot = (
                        <View
                            key={s.id}
                            style={[
                                styles.progressDot,
                                isDone && styles.progressDotComplete,
                                isActive && styles.progressDotActive,
                            ]}
                        />
                    );
                    return isActive ? (
                        <GlowView key={s.id} color={colors.glowGreen} intensity="subtle">
                            {dot}
                        </GlowView>
                    ) : dot;
                })}
            </View>

            {/* Step Counter */}
            <Text style={styles.stepCounter}>
                STEP {currentStep} OF {TUTORIAL_STEPS.length}
            </Text>

            {/* Scrollable middle: main content + completed steps */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Content */}
                <View style={styles.content}>
                    {step.iconName ? (
                        <AppIcon name={step.iconName} size={56} style={styles.stepIconImg} />
                    ) : (
                        <Text style={styles.icon}>{step.icon}</Text>
                    )}
                    <Text style={styles.title}>{step.title}</Text>

                    <View style={styles.divider} />

                    <Text style={styles.description}>{step.description}</Text>

                    {step.tip && (
                        <View style={styles.tipContainer}>
                            <AppIcon name="boost" size={14} style={{ marginRight: 6, alignSelf: 'center' }} />
                            <Text style={styles.tipLabel}> TIP</Text>
                            <Text style={styles.tipText}>{step.tip}</Text>
                        </View>
                    )}
                </View>

                {/* Completed Steps Summary */}
                {completedSteps.length > 0 && (
                    <View style={styles.completedSection}>
                        {TUTORIAL_STEPS.filter(s => completedSteps.includes(s.id)).map(s => (
                            <View key={s.id} style={styles.completedItem}>
                                <Text style={styles.completedCheck}>✓</Text>
                                <Text style={styles.completedText}>{s.title}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Actions — primary button is gradient CTA, skip stays flat */}
            <View style={styles.actions}>
                <GlowView color={colors.glowGreen} intensity="subtle">
                    <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                        <TouchableOpacity
                            onPressIn={btnPressIn}
                            onPressOut={btnPressOut}
                            onPress={() => onStepAction(currentStep)}
                            activeOpacity={1}
                        >
                            <LinearGradient
                                colors={[colors.gradientStart, colors.gradientEnd]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.primaryButton}
                            >
                                <Text style={styles.primaryButtonText}>{step.action}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </GlowView>

                <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
                    <Text style={styles.skipButtonText}>
                        {currentStep === TUTORIAL_STEPS.length ? 'FINISH LATER' : 'SKIP FOR NOW'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    You can access this setup anytime from Settings
                </Text>
            </View>
        </View>
    );
}

// Simple component for dashboard integration
interface SetupProgressProps {
    completedSteps: number;
    totalSteps: number;
    onContinue: () => void;
}

export function SetupProgress({ completedSteps, totalSteps, onContinue }: SetupProgressProps) {
    if (completedSteps >= totalSteps) return null;

    return (
        <TouchableOpacity style={styles.progressCard} onPress={onContinue}>
            <View style={styles.progressCardHeader}>
                <Text style={styles.progressCardTitle}>SETUP INCOMPLETE</Text>
                <Text style={styles.progressCardCount}>
                    {completedSteps}/{totalSteps}
                </Text>
            </View>
            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressBarFill,
                        { width: `${(completedSteps / totalSteps) * 100}%` }
                    ]}
                />
            </View>
            <Text style={styles.progressCardAction}>TAP TO CONTINUE →</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
        marginBottom: spacing.md,
    },
    progressDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.border,
    },
    progressDotComplete: {
        backgroundColor: colors.primary,
    },
    progressDotActive: {
        backgroundColor: colors.accent,
        width: 24,
    },
    stepCounter: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: spacing.xl,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    icon: {
        fontSize: 56,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    stepIconImg: {
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['2xl'],
        color: colors.primary,
        textAlign: 'center',
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    divider: {
        width: 60,
        height: 2,
        backgroundColor: colors.primary,
        marginBottom: spacing.lg,
    },
    description: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.md,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 26,
        marginBottom: spacing.lg,
    },
    tipContainer: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        width: '100%',
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    tipLabel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.accent,
        marginBottom: spacing.xs,
    },
    tipText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    completedSection: {
        marginBottom: spacing.lg,
    },
    completedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    completedCheck: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.primary,
        marginRight: spacing.sm,
    },
    completedText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textDecorationLine: 'line-through',
    },
    actions: {
        marginBottom: spacing.lg,
    },
    primaryButton: {
        paddingVertical: spacing.lg,
        borderRadius: 6,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    primaryButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.textOnPrimary,
        letterSpacing: 2,
    },
    skipButton: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    skipButtonText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
    },
    footer: {
        alignItems: 'center',
    },
    footerText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },

    // Progress Card (for dashboard)
    progressCard: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    progressCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    progressCardTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.accent,
        letterSpacing: 1,
    },
    progressCardCount: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.border,
        marginBottom: spacing.sm,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: colors.accent,
    },
    progressCardAction: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
});

export default SetupTutorialScreen;
