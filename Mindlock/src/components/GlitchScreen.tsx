import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { colors } from '../theme/colors';
import { typography, fontFamilies, fontSizes } from '../theme/typography';
import { spacing } from '../theme';

const { width, height } = Dimensions.get('window');

interface GlitchScreenProps {
    onAnimationComplete?: () => void;
    message?: string;
    /** Explanation shown after the glitch animation — teaches the correct answer */
    explanation?: string;
    /** The correct answer text (shown above explanation) */
    correctAnswer?: string;
}

/**
 * System Failure Glitch Screen
 * 
 * Displayed when user gets a wrong answer - creates a
 * dramatic "system failure" effect with glitching text
 */
export function GlitchScreen({
    onAnimationComplete,
    message = 'WRONG ANSWER',
    explanation,
    correctAnswer,
}: GlitchScreenProps) {
    // Animation values
    const glitchAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const flashAnim = useRef(new Animated.Value(0)).current;
    const scanlineAnim = useRef(new Animated.Value(0)).current;
    const textGlitch1 = useRef(new Animated.Value(0)).current;
    const textGlitch2 = useRef(new Animated.Value(0)).current;
    const explanationOpacity = useRef(new Animated.Value(0)).current;
    const [showExplanation, setShowExplanation] = React.useState(false);

    useEffect(() => {
        // Initial flash
        Animated.sequence([
            Animated.timing(flashAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(flashAnim, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Screen shake
        const shakeSequence = Animated.loop(
            Animated.sequence([
                Animated.timing(shakeAnim, {
                    toValue: 10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: -10,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: 5,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: -5,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: 0,
                    duration: 50,
                    useNativeDriver: true,
                }),
            ]),
            { iterations: 3 }
        );
        shakeSequence.start();

        // Main glitch effect
        const glitchSequence = Animated.loop(
            Animated.sequence([
                Animated.timing(glitchAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(glitchAnim, {
                    toValue: 0,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.delay(200),
            ]),
            { iterations: 5 }
        );
        glitchSequence.start();

        // Text glitch layers
        const textGlitchLoop = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(textGlitch1, {
                        toValue: -5,
                        duration: 80,
                        useNativeDriver: true,
                    }),
                    Animated.timing(textGlitch1, {
                        toValue: 5,
                        duration: 80,
                        useNativeDriver: true,
                    }),
                    Animated.timing(textGlitch1, {
                        toValue: 0,
                        duration: 80,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(textGlitch2, {
                        toValue: 5,
                        duration: 60,
                        useNativeDriver: true,
                    }),
                    Animated.timing(textGlitch2, {
                        toValue: -5,
                        duration: 60,
                        useNativeDriver: true,
                    }),
                    Animated.timing(textGlitch2, {
                        toValue: 0,
                        duration: 60,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );
        textGlitchLoop.start();

        // Scanline animation
        Animated.loop(
            Animated.timing(scanlineAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: true,
            })
        ).start();

        // After 2s glitch, show explanation (if available) then auto-dismiss
        const glitchDuration = 2000;
        const explanationDuration = explanation ? 3000 : 0;

        const glitchTimer = setTimeout(() => {
            if (explanation) {
                setShowExplanation(true);
                Animated.timing(explanationOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }).start();
            }
        }, glitchDuration);

        const completionTimer = setTimeout(() => {
            onAnimationComplete?.();
        }, glitchDuration + explanationDuration);

        return () => {
            clearTimeout(glitchTimer);
            clearTimeout(completionTimer);
            shakeSequence.stop();
            glitchSequence.stop();
            textGlitchLoop.stop();
        };
    }, []);

    const scanlineTranslate = scanlineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-height, height],
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateX: shakeAnim }] }
            ]}
        >
            {/* Flash overlay */}
            <Animated.View
                style={[
                    styles.flashOverlay,
                    { opacity: flashAnim }
                ]}
            />

            {/* Scanlines */}
            <Animated.View
                style={[
                    styles.scanline,
                    { transform: [{ translateY: scanlineTranslate }] }
                ]}
            />

            {/* Glitch bars */}
            <Animated.View
                style={[
                    styles.glitchBar,
                    styles.glitchBar1,
                    { opacity: glitchAnim }
                ]}
            />
            <Animated.View
                style={[
                    styles.glitchBar,
                    styles.glitchBar2,
                    { opacity: glitchAnim }
                ]}
            />
            <Animated.View
                style={[
                    styles.glitchBar,
                    styles.glitchBar3,
                    { opacity: glitchAnim }
                ]}
            />

            {/* Main content */}
            <View style={styles.content}>
                {/* Error icon */}
                <Text style={styles.errorIcon}>⚠</Text>

                {/* Glitched text layers */}
                <View style={styles.textContainer}>
                    <Animated.Text
                        style={[
                            styles.glitchText,
                            styles.glitchTextRed,
                            { transform: [{ translateX: textGlitch1 }] }
                        ]}
                    >
                        {message}
                    </Animated.Text>
                    <Animated.Text
                        style={[
                            styles.glitchText,
                            styles.glitchTextBlue,
                            { transform: [{ translateX: textGlitch2 }] }
                        ]}
                    >
                        {message}
                    </Animated.Text>
                    <Text style={styles.glitchText}>{message}</Text>
                </View>

                {/* Error code */}
                <Text style={styles.errorCode}>ERROR: 0x4E4F5045</Text>
                <Text style={styles.subText}>SYSTEM FAILURE</Text>
                <Text style={styles.subText}>KNOWLEDGE VERIFICATION FAILED</Text>

                {/* Terminal-style output */}
                <View style={styles.terminal}>
                    <Text style={styles.terminalText}>
                        {'>'} answer.validate() ... FAILED{'\n'}
                        {'>'} access.denied(){'\n'}
                        {'>'} retry.init()
                    </Text>
                </View>
            </View>

            {/* CRT effect overlay */}
            <View style={styles.crtOverlay} pointerEvents="none" />

            {/* Explanation card — fades in after glitch animation */}
            {showExplanation && explanation && (
                <Animated.View
                    style={[
                        styles.explanationCard,
                        { opacity: explanationOpacity },
                    ]}
                >
                    <Text style={styles.explanationLabel}>HERE’S WHY</Text>
                    {correctAnswer && (
                        <Text style={styles.correctAnswerText}>
                            ✓ {correctAnswer}
                        </Text>
                    )}
                    <Text style={styles.explanationText}>{explanation}</Text>
                </Animated.View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    flashOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.error,
    },
    scanline: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    glitchBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 3,
    },
    glitchBar1: {
        top: '20%',
        backgroundColor: colors.error,
    },
    glitchBar2: {
        top: '45%',
        backgroundColor: colors.accent,
        height: 5,
    },
    glitchBar3: {
        top: '70%',
        backgroundColor: colors.primary,
    },
    content: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    errorIcon: {
        fontSize: 80,
        marginBottom: spacing.lg,
    },
    textContainer: {
        position: 'relative',
        marginBottom: spacing.lg,
    },
    glitchText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['3xl'],
        color: colors.error,
        letterSpacing: 4,
        textAlign: 'center',
    },
    glitchTextRed: {
        position: 'absolute',
        color: '#FF0000',
        opacity: 0.7,
        left: -2,
    },
    glitchTextBlue: {
        position: 'absolute',
        color: '#00FFFF',
        opacity: 0.7,
        left: 2,
    },
    errorCode: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: colors.textMuted,
        letterSpacing: 2,
        marginBottom: spacing.sm,
    },
    subText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.base,
        color: colors.error,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    terminal: {
        marginTop: spacing.xl,
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.error,
        width: width * 0.8,
    },
    terminalText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.error,
        lineHeight: 18,
    },
    crtOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    explanationCard: {
        position: 'absolute',
        bottom: 60,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: 'rgba(0, 20, 30, 0.92)',
        borderWidth: 1,
        borderColor: '#00FFFF44',
        borderRadius: 8,
        padding: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: '#00FFFF',
    },
    explanationLabel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#00FFFF',
        letterSpacing: 2,
        marginBottom: spacing.xs,
    },
    correctAnswerText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.base,
        color: '#4ADE80',
        marginBottom: spacing.sm,
    },
    explanationText: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        color: '#E2E8F0',
        lineHeight: 20,
    },
});

export default GlitchScreen;
