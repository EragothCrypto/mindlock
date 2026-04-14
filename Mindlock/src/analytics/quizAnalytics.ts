import AsyncStorage from '@react-native-async-storage/async-storage';

// ===========================================================================
// QUIZ ANALYTICS — Per-topic performance tracking
// ===========================================================================

const ANALYTICS_KEY = '@mindlock_quiz_analytics';

// Maps each question to a topic category
// Must stay in sync with MindlockQuizActivity.kt question bank
export const TOPIC_CATEGORIES = {
    // Easy topics
    'native_token': 'Solana Basics',
    'seeker_phone': 'Seeker Hardware',
    'popular_wallet': 'Wallets & dApps',
    'solana_founder': 'Solana History',
    'nft_marketplace': 'NFTs & Marketplaces',
    'solana_tps': 'Solana Performance',
    // Hard topics
    'consensus_poh': 'Proof of History',
    'rust_language': 'Solana Development',
    'spl_library': 'SPL Tokens & Programs',
    'anchor_framework': 'Anchor Framework',
    'skr_token': '$SKR & Seeker',
    'guardian_staking': '$SKR & Seeker',
    'poh_acronym': 'Proof of History',
} as const;

export type TopicCategory =
    | 'Solana Basics'
    | 'Seeker Hardware'
    | 'Wallets & dApps'
    | 'Solana History'
    | 'NFTs & Marketplaces'
    | 'Solana Performance'
    | 'Proof of History'
    | 'Solana Development'
    | 'SPL Tokens & Programs'
    | 'Anchor Framework'
    | '$SKR & Seeker';

export interface TopicStats {
    topic: TopicCategory;
    correct: number;
    wrong: number;
    total: number;
    accuracy: number; // 0–100
}

export interface QuizAttempt {
    timestamp: number;
    topic: TopicCategory;
    difficulty: 'easy' | 'hard';
    correct: boolean;
}

export interface AnalyticsSummary {
    topicStats: TopicStats[];
    weakAreas: TopicCategory[];       // < 60% accuracy
    strongAreas: TopicCategory[];     // >= 80% accuracy
    totalAttempts: number;
    suggestions: string[];
}

// Learning path suggestions keyed by topic
const LEARNING_SUGGESTIONS: Record<TopicCategory, string> = {
    'Solana Basics': 'Read Solana docs: What is Solana? → solana.com/docs',
    'Seeker Hardware': 'Explore Seeker specs at solana.mobile',
    'Wallets & dApps': 'Try Phantom or Backpack wallet — explore the dApp Store',
    'Solana History': 'Read Anatoly\'s original Solana whitepaper (2017)',
    'NFTs & Marketplaces': 'Browse Magic Eden: magiceden.io/solana',
    'Solana Performance': 'Study Solana\'s architecture: 65,000 TPS via PoH + Tower BFT',
    'Proof of History': 'Deep-dive: "What is Proof of History?" on Solana docs',
    'Solana Development': 'Learn Rust basics: The Rust Book → doc.rust-lang.org/book',
    'SPL Tokens & Programs': 'Study spl.solana.com — especially Token and Token-2022',
    'Anchor Framework': 'Work through Anchor\'s official tutorial: anchor-lang.com',
    '$SKR & Seeker': 'Join the Seeker community and read the $SKR staking docs',
};

/**
 * Quiz Analytics Service
 * Records per-topic results and computes weak/strong areas.
 */
class QuizAnalyticsService {
    /**
     * Record a single question attempt
     */
    async recordAttempt(topic: TopicCategory, difficulty: 'easy' | 'hard', correct: boolean): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(ANALYTICS_KEY);
            const attempts: QuizAttempt[] = stored ? JSON.parse(stored) : [];

            attempts.push({
                timestamp: Date.now(),
                topic,
                difficulty,
                correct,
            });

            // Keep last 500 attempts to avoid unbounded storage growth
            const trimmed = attempts.slice(-500);
            await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.warn('QuizAnalytics: recordAttempt failed', e);
        }
    }

    /**
     * Get full analytics summary
     */
    async getSummary(): Promise<AnalyticsSummary> {
        try {
            const stored = await AsyncStorage.getItem(ANALYTICS_KEY);
            const attempts: QuizAttempt[] = stored ? JSON.parse(stored) : [];

            // Aggregate per-topic
            const map = new Map<TopicCategory, { correct: number; wrong: number }>();
            for (const a of attempts) {
                const entry = map.get(a.topic) ?? { correct: 0, wrong: 0 };
                if (a.correct) entry.correct++; else entry.wrong++;
                map.set(a.topic, entry);
            }

            const topicStats: TopicStats[] = [];
            for (const [topic, { correct, wrong }] of map.entries()) {
                const total = correct + wrong;
                topicStats.push({
                    topic,
                    correct,
                    wrong,
                    total,
                    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
                });
            }

            // Sort worst → best
            topicStats.sort((a, b) => a.accuracy - b.accuracy);

            const weakAreas = topicStats.filter(t => t.total >= 2 && t.accuracy < 60).map(t => t.topic);
            const strongAreas = topicStats.filter(t => t.total >= 2 && t.accuracy >= 80).map(t => t.topic);

            const suggestions = weakAreas.slice(0, 3).map(topic => LEARNING_SUGGESTIONS[topic]);

            return {
                topicStats,
                weakAreas,
                strongAreas,
                totalAttempts: attempts.length,
                suggestions,
            };
        } catch (e) {
            console.warn('QuizAnalytics: getSummary failed', e);
            return { topicStats: [], weakAreas: [], strongAreas: [], totalAttempts: 0, suggestions: [] };
        }
    }

    /** Clear all analytics data */
    async reset(): Promise<void> {
        await AsyncStorage.removeItem(ANALYTICS_KEY);
    }

    /**
     * Map a question string (from MindlockQuizActivity) to a TopicCategory.
     * Called from JS after the native quiz activity reports results.
     */
    inferTopic(question: string, difficulty: 'easy' | 'hard'): TopicCategory {
        const q = question.toLowerCase();
        if (q.includes('native token') || q.includes('sol')) return 'Solana Basics';
        if (q.includes('seeker') || q.includes('mobile phone')) return 'Seeker Hardware';
        if (q.includes('wallet') && !q.includes('seed')) return 'Wallets & dApps';
        if (q.includes('founder') || q.includes('co-founder')) return 'Solana History';
        if (q.includes('nft') || q.includes('marketplace') || q.includes('magic eden')) return 'NFTs & Marketplaces';
        if (q.includes('tps') || q.includes('capacity')) return 'Solana Performance';
        if (q.includes('proof of history') || q.includes('poh')) return 'Proof of History';
        if (q.includes('language') || q.includes('rust')) return 'Solana Development';
        if (q.includes('spl') || q.includes('program library')) return 'SPL Tokens & Programs';
        if (q.includes('anchor') || q.includes('framework')) return 'Anchor Framework';
        if (q.includes('skr') || q.includes('guardian')) return '$SKR & Seeker';
        return difficulty === 'hard' ? 'Solana Development' : 'Solana Basics';
    }
}

export const quizAnalytics = new QuizAnalyticsService();
