import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    Animated,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography, fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';

interface HardwareVerificationScreenProps {
    onRetry: () => void;
    isLoading?: boolean;
}

/**
 * Screen displayed when user doesn't own a Seeker Genesis NFT.
 * Prompts them to verify their Seeker hardware ownership.
 */
export function HardwareVerificationScreen({
    onRetry,
    isLoading = false,
}: HardwareVerificationScreenProps) {
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    const handleLearnMore = () => {
        Linking.openURL('https://solanamobile.com/seeker');
    };

    return (
        <View style={styles.container}>
            {/* Glowing Lock Icon */}
            <Animated.View
                style={[
                    styles.iconContainer,
                    { transform: [{ scale: pulseAnim }] },
                ]}
            >
                <Text style={styles.lockIcon}>🔒</Text>
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>HARDWARE{'\n'}VERIFICATION{'\n'}REQUIRED</Text>

            {/* Description */}
            <Text style={styles.description}>
                Mindlock requires verification of your{' '}
                <Text style={styles.highlight}>Seeker Genesis NFT</Text> to unlock
                premium features and prove you're part of the Solana Mobile ecosystem.
            </Text>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>{'>'} WHY VERIFICATION?</Text>
                <Text style={styles.infoText}>
                    Your Seeker device comes with a Genesis NFT that proves ownership.
                    Connect a wallet holding this NFT to continue.
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={onRetry}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? 'SCANNING...' : 'RETRY VERIFICATION'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={handleLearnMore}
                >
                    <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                        LEARN ABOUT SEEKER
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Terminal-style footer */}
            <View style={styles.terminal}>
                <Text style={styles.terminalText}>
                    {'>'} wallet_connected: true{'\n'}
                    {'>'} seeker_nft_detected: false{'\n'}
                    {'>'} access_level: RESTRICTED
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        ...shadows.glow,
    },
    lockIcon: {
        fontSize: 48,
    },
    title: {
        ...typography.h1,
        color: colors.error,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    description: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.md,
    },
    highlight: {
        color: colors.primary,
        fontFamily: fontFamilies.monoBold,
    },
    infoBox: {
        backgroundColor: colors.surface,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
        padding: spacing.md,
        marginBottom: spacing.xl,
        width: '100%',
    },
    infoTitle: {
        ...typography.label,
        color: colors.accent,
        marginBottom: spacing.sm,
    },
    infoText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    actions: {
        width: '100%',
        gap: spacing.md,
    },
    button: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: colors.error,
        borderWidth: 2,
        borderColor: colors.error,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.textMuted,
    },
    buttonText: {
        ...typography.button,
        color: colors.textPrimary,
    },
    secondaryButtonText: {
        color: colors.textSecondary,
    },
    terminal: {
        position: 'absolute',
        bottom: spacing.xl,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    terminalText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        lineHeight: 16,
    },
});

export default HardwareVerificationScreen;
