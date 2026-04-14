import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { PublicKey } from '@solana/web3.js';
import { colors } from '../theme/colors';
import { typography, fontFamilies, fontSizes } from '../theme/typography';
import { spacing, shadows } from '../theme';
import { QuizQuestion, getShuffledQuestions } from '../data/questionBank';
import { getShuffledDynamicQuestions, computeQuestionSetHashBytes } from '../data/dynamicQuestions';
import { GlitchScreen } from './GlitchScreen';
import { mindlockWarden } from '../native/MindlockWarden';
import { redistributionAgent, LAZY_UNLOCK_FEE_USD } from '../solana/redistributionAgent';
import { createMWASigner } from '../solana/mwaWallet';
import { submitScoreOnChain } from '../solana/scoreRegistry';
import { dayPassManager, DAY_PASS_PRICE_USD, DayPassStatus } from '../solana/dayPass';
import { AppIcon, IconSizes } from './AppIcon';

const { width } = Dimensions.get('window');
const QUESTIONS_PER_QUIZ = 3; // Banger mode: 3 questions with 1 hard
const UNLOCK_DURATION_MINUTES = 60;

type QuizState = 'intro' | 'quiz' | 'wrong' | 'success' | 'signing' | 'lazy-unlock' | 'day-pass';

interface KnowledgeGateProps {
    onUnlockSuccess: () => void;
    onCancel?: () => void;
    walletAddress?: string;
}

/**
 * Knowledge Gate Component
 * 
 * Full-screen quiz that gates access to social apps.
 * User must answer 5/5 correctly to trigger Seed Vault
 * sign-to-unlock for 1 hour.
 */
export function KnowledgeGate({
    onUnlockSuccess,
    onCancel,
    walletAddress,
}: KnowledgeGateProps) {
    const [state, setState] = useState<QuizState>('intro');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [showFeedback, setShowFeedback] = useState(false);
    const [lazyFee, setLazyFee] = useState<string>('~$1.50');
    const [isProcessingLazy, setIsProcessingLazy] = useState(false);
    const [dayPassStatus, setDayPassStatus] = useState<DayPassStatus | null>(null);
    const [isProcessingDayPass, setIsProcessingDayPass] = useState(false);
    /** Stores the question the user got wrong — used to pass explanation to GlitchScreen */
    const [wrongQuestion, setWrongQuestion] = useState<QuizQuestion | null>(null);

    // Animations
    const progressAnim = useState(new Animated.Value(0))[0];
    const cardAnim = useState(new Animated.Value(0))[0];
    const pulseAnim = useState(new Animated.Value(1))[0];

    // Load questions on mount (with dynamic Gist updates)
    useEffect(() => {
        const loadQuestions = async () => {
            try {
                // Try dynamic questions first (Gist with 24h cache)
                const dynamicQuestions = await getShuffledDynamicQuestions(QUESTIONS_PER_QUIZ);
                setQuestions(dynamicQuestions);
            } catch {
                // Fallback to bundled questions
                const fallbackQuestions = getShuffledQuestions(QUESTIONS_PER_QUIZ);
                setQuestions(fallbackQuestions);
            }
        };
        loadQuestions();

        // Load Day Pass status
        const loadDayPassStatus = async () => {
            try {
                const status = await dayPassManager.getStatus();
                setDayPassStatus(status);
            } catch (e) {
                __DEV__ && console.log('Day Pass status check failed:', e);
            }
        };
        loadDayPassStatus();
    }, []);

    // Progress bar animation
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: (currentIndex + 1) / QUESTIONS_PER_QUIZ,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [currentIndex]);

    // Card entrance animation
    useEffect(() => {
        cardAnim.setValue(0);
        Animated.spring(cardAnim, {
            toValue: 1,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, [currentIndex]);

    // Pulse animation for success state
    useEffect(() => {
        if (state === 'success') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.05,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [state]);

    const startQuiz = () => {
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setCorrectCount(0);
        setShowFeedback(false);
        setState('quiz');
    };

    // Lazy Unlock - Pay to skip via on-chain charity donation
    const handleLazyUnlock = async () => {
        if (!walletAddress) {
            Alert.alert('Wallet Required', 'Connect your wallet first to use Lazy Unlock.');
            return;
        }

        setIsProcessingLazy(true);
        setState('lazy-unlock');

        try {
            const userPublicKey = new PublicKey(walletAddress);

            // Check if user can afford the unlock
            const affordCheck = await redistributionAgent.canAffordUnlock(userPublicKey);
            if (!affordCheck.canAfford) {
                Alert.alert(
                    'Insufficient $SKR',
                    `You need ${affordCheck.required.toFixed(0)} $SKR but only have ${affordCheck.balance.toFixed(0)}.\n\nGet $SKR from Jupiter or earn through Mindlock rewards!`,
                    [{ text: 'Got it', onPress: () => setState('intro') }]
                );
                setIsProcessingLazy(false);
                return;
            }

            // Create MWA signer for this transaction
            const signTransaction = createMWASigner(userPublicKey);

            // Process the lazy unlock (signs & sends on-chain!)
            const result = await redistributionAgent.processLazyUnlock(
                userPublicKey,
                signTransaction
            );

            if (result.success) {
                __DEV__ && console.log('🎁 Charity donation successful!', result.txSignature);
                Alert.alert(
                    '💝 Donation Complete!',
                    `You donated ${result.skrDonated.toFixed(0)} $SKR (~$${result.usdValue.toFixed(2)}) to charity!\n\nYour Karma: ${result.newKarmaScore} (${result.karmaLevel})`,
                    [{
                        text: 'Nice!', onPress: () => {
                            setState('success');
                            onUnlockSuccess();
                        }
                    }]
                );
            } else {
                throw new Error(result.error || 'Transaction failed');
            }
        } catch (error) {
            console.error('Lazy unlock failed:', error);
            Alert.alert(
                'Transaction Failed',
                error instanceof Error ? error.message : 'Could not process donation',
                [{ text: 'Try Again', onPress: () => setState('intro') }]
            );
        } finally {
            setIsProcessingLazy(false);
        }
    };

    // Day Pass - "Last Resort" Emergency Break (24h shield, 7-day cooldown)
    const handleDayPass = async () => {
        if (!walletAddress) {
            Alert.alert('Wallet Required', 'Connect your wallet first to use Day Pass.');
            return;
        }

        if (!dayPassStatus?.canPurchase) {
            const remaining = dayPassManager.formatCooldown(dayPassStatus?.cooldownRemainingMs || 0);
            Alert.alert('Cooldown Active', `Day Pass is on cooldown. Available in ${remaining}.`);
            return;
        }

        // Confirm premium price
        Alert.alert(
            '🛡️ Emergency Break',
            `Activate Shield Mode for 24 hours?\n\nCost: ~$${DAY_PASS_PRICE_USD.toFixed(2)} (500 $SKR)\n50% Charity • 50% Scholarship\n\nYour streak will be frozen (not broken).`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Activate Shield', onPress: executeDayPass },
            ]
        );
    };

    const executeDayPass = async () => {
        setIsProcessingDayPass(true);
        setState('day-pass');

        try {
            const userPubkey = new PublicKey(walletAddress!);
            const signTransaction = createMWASigner(userPubkey);

            const result = await dayPassManager.purchaseDayPass(
                userPubkey,
                signTransaction
            );

            if (result.success) {
                Alert.alert(
                    '🛡️ Shield Activated!',
                    'Emergency Break active for 24 hours.\n\nYour streak is frozen. The Warden will return tomorrow.',
                    [{ text: 'OK', onPress: onUnlockSuccess }]
                );
            } else {
                Alert.alert(
                    'Purchase Failed',
                    result.error || 'Could not activate Day Pass.',
                    [{ text: 'OK', onPress: () => setState('intro') }]
                );
            }
        } catch (error) {
            console.error('Day Pass failed:', error);
            Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Day Pass purchase failed.',
                [{ text: 'OK', onPress: () => setState('intro') }]
            );
        } finally {
            setIsProcessingDayPass(false);
        }
    };

    const handleAnswerSelect = (index: number) => {
        if (showFeedback) return;
        setSelectedAnswer(index);
    };

    const handleSubmit = async () => {
        if (selectedAnswer === null) return;

        const currentQuestion = questions[currentIndex];
        const isCorrect = selectedAnswer === currentQuestion.correctIndex;

        if (isCorrect) {
            const newCorrectCount = correctCount + 1;
            setCorrectCount(newCorrectCount);
            setShowFeedback(true);

            // Short delay to show green feedback
            setTimeout(() => {
                if (currentIndex < QUESTIONS_PER_QUIZ - 1) {
                    // Next question
                    setCurrentIndex(currentIndex + 1);
                    setSelectedAnswer(null);
                    setShowFeedback(false);
                } else if (newCorrectCount === QUESTIONS_PER_QUIZ) {
                    // Perfect score! Trigger unlock
                    handlePerfectScore();
                }
            }, 500);
        } else {
            // Wrong answer - store the question for explanation display
            setWrongQuestion(currentQuestion);
            setState('wrong');
        }
    };

    const handlePerfectScore = async () => {
        setState('signing');

        try {
            // 1. Trigger the native OS unlock (primary path — must succeed)
            await mindlockWarden.grantTempUnlock();

            // 2. Fire on-chain quiz attestation (non-fatal — runs in background)
            //    Emits QuizPassed event on Solana Explorer for verifiable proof-of-brain.
            if (walletAddress) {
                const userPubkey = new (require('@solana/web3.js').PublicKey)(walletAddress);
                const signTx = createMWASigner(userPubkey);

                // Compute accuracy from correct answers
                const accuracy = Math.round((correctCount / QUESTIONS_PER_QUIZ) * 100);

                // Determine max difficulty in this question set
                const maxDifficulty = questions.reduce((max, q) => {
                    const d = q.difficulty === 'hard' ? 2 : q.difficulty === 'medium' ? 1 : 0;
                    return Math.max(max, d);
                }, 0);

                // Non-blocking — don't await, don't block the user's unlock
                // Compute the real SHA-256 content hash for on-chain attestation
                computeQuestionSetHashBytes(questions).then(hashBytes => {
                    submitScoreOnChain({
                        wallet: userPubkey,
                        signTransaction: signTx,
                        focusMinutes: UNLOCK_DURATION_MINUTES,
                        accuracy,
                        questions,
                        maxDifficulty,
                        questionSetHash: hashBytes,
                    }).then(result => {
                        if (result.success) {
                            __DEV__ && console.log(`🏆 QuizPassed attested on-chain: ${result.txSignature}`);
                        }
                    }).catch(err => {
                        console.warn('On-chain attestation skipped:', err);
                    });
                }).catch(err => {
                    console.warn('Hash computation failed:', err);
                });
            }

            setState('success');

            // Auto-dismiss after delay
            setTimeout(() => {
                onUnlockSuccess();
            }, 3000);
        } catch (error) {
            console.error('Unlock failed:', error);
            setState('quiz'); // Let user try again
        }
    };

    const handleGlitchComplete = async () => {
        // Reset quiz with new questions
        try {
            const newQuestions = await getShuffledDynamicQuestions(QUESTIONS_PER_QUIZ);
            setQuestions(newQuestions);
        } catch {
            setQuestions(getShuffledQuestions(QUESTIONS_PER_QUIZ));
        }
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setCorrectCount(0);
        setShowFeedback(false);
        setState('quiz');
    };

    // ========== RENDER STATES ==========

    if (state === 'wrong') {
        return (
            <GlitchScreen
                onAnimationComplete={handleGlitchComplete}
                explanation={wrongQuestion?.explanation}
                correctAnswer={
                    wrongQuestion
                        ? wrongQuestion.options[wrongQuestion.correctIndex]
                        : undefined
                }
            />
        );
    }

    if (state === 'signing') {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.signingText}>REQUESTING SEED VAULT SIGNATURE...</Text>
                    <Text style={styles.signingSubtext}>Confirm on your device</Text>
                </View>
            </View>
        );
    }

    if (state === 'success') {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Text style={styles.successIcon}>🔓</Text>
                    </Animated.View>
                    <Text style={styles.successTitle}>ACCESS GRANTED</Text>
                    <Text style={styles.successSubtitle}>
                        Apps unlocked for {UNLOCK_DURATION_MINUTES} minutes
                    </Text>
                    <View style={styles.successBadge}>
                        <Text style={styles.successBadgeText}>3/3 CORRECT</Text>
                    </View>
                    <Text style={styles.successHint}>
                        Your knowledge has been verified.{'\n'}
                        Use your time wisely.
                    </Text>
                </View>
            </View>
        );
    }

    // Lazy unlock processing state
    if (state === 'lazy-unlock') {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.signingText}>PROCESSING CHARITY DONATION...</Text>
                    <Text style={styles.signingSubtext}>
                        Approve the transaction in your Seed Vault
                    </Text>
                    <Text style={styles.charityNote}>
                        💝 100% goes to charity • You earn Karma!
                    </Text>
                </View>
            </View>
        );
    }

    if (state === 'intro') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.logo}>MINDLOCK</Text>
                    {onCancel && (
                        <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
                            <Text style={styles.cancelText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.centerContent}>
                    <Text style={styles.gateIcon}>🧠</Text>
                    <Text style={styles.gateTitle}>KNOWLEDGE GATE</Text>
                    <Text style={styles.gateSubtitle}>
                        EARN your unlock by proving Solana knowledge.{'\n'}
                        No shortcuts. Your brain is the key.
                    </Text>

                    <View style={styles.rulesBox}>
                        <Text style={styles.rulesTitle}>{'>'} PROVE YOUR KNOWLEDGE</Text>
                        <Text style={styles.ruleItem}>• 3 Questions • 1 is HARD 💀</Text>
                        <Text style={styles.ruleItem}>• Wrong answer = Start over</Text>
                        <Text style={styles.ruleItem}>• 3/3 correct = 1 hour unlock</Text>
                    </View>

                    <TouchableOpacity style={styles.startButton} onPress={startQuiz}>
                        <Text style={styles.startButtonText}>BEGIN VERIFICATION</Text>
                    </TouchableOpacity>

                    {/* Lazy Unlock - Charity Donation Option */}
                    <View style={styles.lazyUnlockSection}>
                        <Text style={styles.lazyUnlockLabel}>or skip with a donation</Text>
                        <TouchableOpacity
                            style={[styles.lazyUnlockButton, isProcessingLazy && styles.buttonDisabled]}
                            onPress={handleLazyUnlock}
                            disabled={isProcessingLazy}
                        >
                            {isProcessingLazy ? (
                                <ActivityIndicator color={colors.textOnPrimary} size="small" />
                            ) : (
                                <>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <AppIcon name="heart" size={IconSizes.md} />
                                        <Text style={styles.lazyUnlockButtonText}>
                                            DONATE ~${LAZY_UNLOCK_FEE_USD.toFixed(2)} TO CHARITY
                                        </Text>
                                    </View>
                                    <Text style={styles.lazyUnlockSubtext}>
                                        100% goes to charity • Earn Karma points!
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Day Pass - Last Resort Emergency Break */}
                    {dayPassStatus && (
                        <View style={styles.dayPassSection}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <AppIcon name="shield" size={IconSizes.md} tint="#F59E0B" />
                                <Text style={styles.dayPassLabel}>LAST RESORT</Text>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.dayPassButton,
                                    (!dayPassStatus.canPurchase || isProcessingDayPass) && styles.buttonDisabled,
                                ]}
                                onPress={handleDayPass}
                                disabled={!dayPassStatus.canPurchase || isProcessingDayPass}
                            >
                                {isProcessingDayPass ? (
                                    <ActivityIndicator color="#F59E0B" size="small" />
                                ) : dayPassStatus.canPurchase ? (
                                    <>
                                        <Text style={styles.dayPassButtonText}>
                                            EMERGENCY BREAK — ~${DAY_PASS_PRICE_USD.toFixed(2)}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={styles.dayPassSubtext}>24h Shield • Streak Frozen </Text>
                                            <AppIcon name="ice" size={IconSizes.sm} />
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <AppIcon name="timer" size={IconSizes.sm} />
                                        <Text style={styles.dayPassCooldown}>
                                            Cooldown: {dayPassManager.formatCooldown(dayPassStatus.cooldownRemainingMs)}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // ========== QUIZ STATE ==========
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return null;

    const cardTranslateY = cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logo}>MINDLOCK</Text>
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>{correctCount}/{QUESTIONS_PER_QUIZ}</Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <Animated.View
                    style={[
                        styles.progressBar,
                        {
                            width: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            })
                        }
                    ]}
                />
            </View>

            {/* Question Card */}
            <Animated.View
                style={[
                    styles.questionCard,
                    {
                        opacity: cardAnim,
                        transform: [{ translateY: cardTranslateY }]
                    }
                ]}
            >
                {/* Category + Difficulty Badge */}
                <View style={styles.badgeRow}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{currentQuestion.category}</Text>
                    </View>
                    <View style={[
                        styles.difficultyBadge,
                        currentQuestion.difficulty === 'Hard' && styles.difficultyHard,
                        currentQuestion.difficulty === 'Medium' && styles.difficultyMedium,
                    ]}>
                        <Text style={styles.difficultyText}>
                            {currentQuestion.difficulty === 'Hard' ? '💀 HARD' : currentQuestion.difficulty.toUpperCase()}
                        </Text>
                    </View>
                </View>

                {/* Question Number */}
                <Text style={styles.questionNumber}>
                    QUESTION {currentIndex + 1} OF {QUESTIONS_PER_QUIZ}
                </Text>

                {/* Question Text */}
                <Text style={styles.questionText}>{currentQuestion.question}</Text>

                {/* Answer Options */}
                <View style={styles.optionsContainer}>
                    {currentQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswer === index;
                        const isCorrect = showFeedback && index === currentQuestion.correctIndex;
                        const isWrong = showFeedback && isSelected && !isCorrect;

                        return (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.optionButton,
                                    isSelected && styles.optionSelected,
                                    isCorrect && styles.optionCorrect,
                                    isWrong && styles.optionWrong,
                                ]}
                                onPress={() => handleAnswerSelect(index)}
                                disabled={showFeedback}
                            >
                                <Text style={[
                                    styles.optionLetter,
                                    isSelected && styles.optionLetterSelected,
                                ]}>
                                    {String.fromCharCode(65 + index)}
                                </Text>
                                <Text style={[
                                    styles.optionText,
                                    isSelected && styles.optionTextSelected,
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        selectedAnswer === null && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={selectedAnswer === null || showFeedback}
                >
                    <Text style={styles.submitButtonText}>
                        {currentIndex === QUESTIONS_PER_QUIZ - 1 ? 'COMPLETE' : 'NEXT'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
    },
    logo: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.lg,
        color: colors.primary,
        letterSpacing: 3,
    },
    cancelButton: {
        padding: spacing.sm,
    },
    cancelText: {
        fontSize: fontSizes.xl,
        color: colors.textMuted,
    },
    scoreContainer: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    scoreText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.primary,
    },
    progressContainer: {
        height: 4,
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    gateIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    gateTitle: {
        ...typography.h1,
        color: colors.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    gateSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    rulesBox: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        marginBottom: spacing.xl,
        width: '100%',
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    rulesTitle: {
        ...typography.label,
        color: colors.accent,
        marginBottom: spacing.md,
    },
    ruleItem: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    ecosystemBox: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: 8,
        padding: spacing.md,
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
    },
    ecosystemText: {
        ...typography.body,
        color: colors.accent,
        textAlign: 'center',
        lineHeight: 22,
    },
    startButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: 4,
        minWidth: 220,
        alignItems: 'center',
        ...shadows.glow,
    },
    startButtonText: {
        ...typography.button,
        color: colors.textOnPrimary,
    },
    questionCard: {
        flex: 1,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    categoryBadge: {
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    categoryText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.background,
        letterSpacing: 1,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    difficultyBadge: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
    },
    difficultyHard: {
        backgroundColor: 'rgba(255, 0, 64, 0.2)',
        borderColor: colors.error,
    },
    difficultyMedium: {
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        borderColor: '#FFA500',
    },
    difficultyText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    questionNumber: {
        ...typography.label,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    },
    questionText: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.xl,
    },
    optionsContainer: {
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        padding: spacing.md,
        borderRadius: 4,
    },
    optionSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.surfaceElevated,
    },
    optionCorrect: {
        borderColor: colors.success,
        backgroundColor: 'rgba(0, 255, 65, 0.1)',
    },
    optionWrong: {
        borderColor: colors.error,
        backgroundColor: 'rgba(255, 0, 64, 0.1)',
    },
    optionLetter: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.md,
        color: colors.textMuted,
        width: 28,
    },
    optionLetterSelected: {
        color: colors.primary,
    },
    optionText: {
        ...typography.body,
        color: colors.textSecondary,
        flex: 1,
    },
    optionTextSelected: {
        color: colors.textPrimary,
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: 4,
        alignItems: 'center',
        ...shadows.glow,
    },
    submitButtonDisabled: {
        backgroundColor: colors.surfaceElevated,
        shadowOpacity: 0,
    },
    submitButtonText: {
        ...typography.button,
        color: colors.textOnPrimary,
    },
    // Signing state
    signingText: {
        ...typography.h3,
        color: colors.primary,
        marginTop: spacing.xl,
        textAlign: 'center',
    },
    signingSubtext: {
        ...typography.body,
        color: colors.textMuted,
        marginTop: spacing.sm,
    },
    // Success state
    successIcon: {
        fontSize: 80,
        marginBottom: spacing.lg,
    },
    successTitle: {
        ...typography.heroTitle,
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    successSubtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    successBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginBottom: spacing.xl,
    },
    successBadgeText: {
        ...typography.button,
        color: colors.textOnPrimary,
    },
    successHint: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
    },
    // Lazy Unlock styles
    charityNote: {
        ...typography.caption,
        color: colors.accent,
        marginTop: spacing.lg,
        textAlign: 'center',
    },
    lazyUnlockSection: {
        marginTop: spacing.xl,
        alignItems: 'center',
        width: '100%',
    },
    lazyUnlockLabel: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        letterSpacing: 1,
    },
    lazyUnlockButton: {
        backgroundColor: colors.accent,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        width: width - spacing.lg * 4,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.accent,
    },
    lazyUnlockButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textOnPrimary,
        letterSpacing: 1,
    },
    lazyUnlockSubtext: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xs,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    // Day Pass (Amber/Gold Emergency Break)
    dayPassSection: {
        marginTop: spacing.lg,
        alignItems: 'center',
    },
    dayPassLabel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#F59E0B',
        marginBottom: spacing.sm,
        letterSpacing: 2,
    },
    dayPassButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#F59E0B',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        width: width - spacing.lg * 4,
        alignItems: 'center',
    },
    dayPassButtonText: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: '#F59E0B',
        letterSpacing: 1,
    },
    dayPassSubtext: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: 'rgba(245, 158, 11, 0.8)',
        marginTop: spacing.xs,
    },
    dayPassCooldown: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        letterSpacing: 1,
    },
});

export default KnowledgeGate;
