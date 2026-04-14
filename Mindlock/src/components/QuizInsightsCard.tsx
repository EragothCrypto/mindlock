/**
 * QuizInsightsCard — Analytics UI Component
 *
 * Displays:
 *  - Per-topic accuracy bars (weak to strong)
 *  - 🔴 Weak areas highlight with learning suggestions
 *  - 💚 Strong areas badge
 *  - Total attempts counter
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontFamilies, fontSizes } from '../theme/typography';
import { spacing } from '../theme';
import { quizAnalytics, AnalyticsSummary } from '../analytics/quizAnalytics';

export function QuizInsightsCard() {
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        loadSummary();
    }, []);

    const loadSummary = async () => {
        const s = await quizAnalytics.getSummary();
        setSummary(s);
    };

    if (!summary || summary.totalAttempts < 3) {
        return (
            <View style={styles.card}>
                <Text style={styles.title}>📊 QUIZ INSIGHTS</Text>
                <Text style={styles.empty}>
                    Answer at least 3 quiz questions to see your topic breakdown and learning suggestions.
                </Text>
            </View>
        );
    }

    const topN = expanded ? summary.topicStats : summary.topicStats.slice(0, 5);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 QUIZ INSIGHTS</Text>
                <Text style={styles.attempts}>{summary.totalAttempts} attempts</Text>
            </View>

            {/* Weak areas alert */}
            {summary.weakAreas.length > 0 && (
                <View style={styles.weakAlert}>
                    <Text style={styles.weakTitle}>⚠️ WEAK AREAS — Focus here:</Text>
                    {summary.suggestions.map((suggestion, i) => (
                        <Text key={i} style={styles.suggestion}>• {suggestion}</Text>
                    ))}
                </View>
            )}

            {/* Strong areas */}
            {summary.strongAreas.length > 0 && (
                <View style={styles.strongRow}>
                    <Text style={styles.strongLabel}>✅ Strong: </Text>
                    <Text style={styles.strongTopics}>{summary.strongAreas.join(' · ')}</Text>
                </View>
            )}

            <View style={styles.divider} />

            {/* Per-topic bars */}
            {topN.map((t) => {
                const isWeak = t.accuracy < 60 && t.total >= 2;
                const isStrong = t.accuracy >= 80 && t.total >= 2;
                const barColor = isWeak ? '#EF4444' : isStrong ? '#22C55E' : '#F59E0B';
                return (
                    <View key={t.topic} style={styles.topicRow}>
                        <View style={styles.topicLabelRow}>
                            <Text style={styles.topicName}>{t.topic}</Text>
                            <Text style={[styles.topicPct, { color: barColor }]}>
                                {t.accuracy}%
                            </Text>
                        </View>
                        <View style={styles.barBackground}>
                            <View style={[styles.barFill, {
                                width: `${t.accuracy}%` as any,
                                backgroundColor: barColor,
                            }]} />
                        </View>
                        <Text style={styles.topicCounts}>{t.correct}/{t.total} correct</Text>
                    </View>
                );
            })}

            {summary.topicStats.length > 5 && (
                <TouchableOpacity onPress={() => setExpanded(e => !e)}>
                    <Text style={styles.showMore}>
                        {expanded ? '▲ Show less' : `▼ Show all ${summary.topicStats.length} topics`}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        padding: spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        letterSpacing: 1,
    },
    attempts: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    empty: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        lineHeight: 18,
        marginTop: spacing.xs,
    },
    weakAlert: {
        backgroundColor: '#EF444415',
        borderLeftWidth: 3,
        borderLeftColor: '#EF4444',
        padding: spacing.sm,
        marginBottom: spacing.sm,
        borderRadius: 4,
    },
    weakTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#EF4444',
        letterSpacing: 1,
        marginBottom: 4,
    },
    suggestion: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        lineHeight: 18,
        marginTop: 2,
    },
    strongRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: spacing.sm,
    },
    strongLabel: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
        color: '#22C55E',
    },
    strongTopics: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: spacing.sm,
    },
    topicRow: {
        marginBottom: spacing.sm,
    },
    topicLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    topicName: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    topicPct: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.xs,
    },
    barBackground: {
        height: 6,
        backgroundColor: colors.border,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 2,
    },
    barFill: {
        height: '100%',
        borderRadius: 3,
    },
    topicCounts: {
        fontFamily: fontFamilies.mono,
        fontSize: 10,
        color: colors.textMuted,
    },
    showMore: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        color: colors.primary,
        textAlign: 'center',
        marginTop: spacing.xs,
        letterSpacing: 0.5,
    },
});
