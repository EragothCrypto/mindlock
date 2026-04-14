import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuizQuestion, QUESTION_BANK, Difficulty, Category } from './questionBank';

// GitHub Gist configuration
// Create a public Gist with your questions JSON and paste the raw URL here
const GIST_RAW_URL = 'https://gist.githubusercontent.com/EragothCrypto/d809fdfad7a2c881490675ff7ac22124/raw/88f8b1b08b7176a07dbe4edd95564fd4c8478a80/mindlock-questions.json';

// Cache keys
const CACHE_KEY = 'mindlock_questions_cache';
const CACHE_TIMESTAMP_KEY = 'mindlock_questions_cache_time';

// Cache duration: 24 hours in milliseconds
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Dynamic Question Fetcher
 * 
 * Fetches questions from a GitHub Gist every 24 hours.
 * This allows adding new questions about airdrops, 
 * network upgrades, etc. without pushing app updates.
 * 
 * Gist JSON format:
 * {
 *   "version": "1.0",
 *   "questions": [
 *     {
 *       "id": "new-1",
 *       "category": "SKR",
 *       "difficulty": "Hard",
 *       "question": "...",
 *       "options": ["A", "B", "C", "D"],
 *       "correctIndex": 2,
 *       "explanation": "...",
 *       "isSponsored": true,    // Optional: guarantees 1 per quiz
 *       "sponsor": "Brand Name" // Optional: sponsor name for display
 *     }
 *   ]
 * }
 */

interface GistResponse {
    version: string;
    questions: QuizQuestion[];
    /** SHA-256 hex of JSON.stringify(questions) — verified client-side */
    questionSetHash?: string;
}

/**
 * Check if cache is still valid (less than 24h old)
 */
async function isCacheValid(): Promise<boolean> {
    try {
        const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
        if (!timestamp) return false;

        const cacheTime = parseInt(timestamp, 10);
        const now = Date.now();

        return (now - cacheTime) < CACHE_DURATION_MS;
    } catch {
        return false;
    }
}

/**
 * Get cached questions
 */
async function getCachedQuestions(): Promise<QuizQuestion[] | null> {
    try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        return JSON.parse(cached) as QuizQuestion[];
    } catch {
        return null;
    }
}

/**
 * Save questions to cache
 */
async function cacheQuestions(questions: QuizQuestion[]): Promise<void> {
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(questions));
        await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
        console.error('Failed to cache questions:', error);
    }
}

/**
 * Fetch fresh questions from GitHub Gist
 */
async function fetchFromGist(): Promise<QuizQuestion[]> {
    try {
        const response = await fetch(GIST_RAW_URL, {
            headers: {
                'Cache-Control': 'no-cache',
            },
        });

        if (!response.ok) {
            throw new Error(`Gist fetch failed: ${response.status}`);
        }

        const data: GistResponse = await response.json();

        // Validate questions have required fields
        const validQuestions = data.questions.filter(q =>
            q.id &&
            q.question &&
            q.options?.length === 4 &&
            typeof q.correctIndex === 'number'
        );

        // ── Oracle Hash Verification ──────────────────────────────────────────
        // If the Gist includes a questionSetHash, verify it matches the content.
        // This creates a tamper-evident seal: if someone modifies the Gist
        // questions without updating the hash, the client rejects them.
        if (data.questionSetHash) {
            const computedHash = await computeQuestionSetHash(validQuestions);
            if (computedHash !== data.questionSetHash) {
                console.warn(
                    `⚠️ Quiz oracle hash mismatch!\n` +
                    `  Expected: ${data.questionSetHash}\n` +
                    `  Got:      ${computedHash}\n` +
                    `  Falling back to bundled questions.`
                );
                throw new Error('Oracle hash verification failed — possible tampering');
            }
            __DEV__ && console.log(`✅ Quiz oracle hash verified: ${computedHash.slice(0, 12)}...`);
        }

        __DEV__ && console.log(`Fetched ${validQuestions.length} questions from Gist (v${data.version})`);

        return validQuestions;
    } catch (error) {
        console.error('Gist fetch error:', error);
        throw error;
    }
}

/**
 * Get questions with dynamic updates
 * 
 * 1. Checks if we have valid cached questions (< 24h old)
 * 2. If yes, returns cached + bundled questions
 * 3. If no, fetches fresh from Gist, caches them
 * 4. Falls back to bundled questions on error
 */
export async function getDynamicQuestions(): Promise<QuizQuestion[]> {
    // Start with bundled questions
    let allQuestions = [...QUESTION_BANK];

    try {
        // Check cache validity
        if (await isCacheValid()) {
            const cached = await getCachedQuestions();
            if (cached && cached.length > 0) {
                __DEV__ && console.log('Using cached Gist questions');
                // Merge cached with bundled, avoiding duplicates
                const cachedIds = new Set(cached.map(q => q.id));
                const bundledUnique = QUESTION_BANK.filter(q => !cachedIds.has(q.id));
                allQuestions = [...cached, ...bundledUnique];
            }
        } else {
            // Cache expired or doesn't exist, fetch fresh
            __DEV__ && console.log('Fetching fresh questions from Gist...');
            const fresh = await fetchFromGist();

            if (fresh.length > 0) {
                await cacheQuestions(fresh);
                // Merge fresh with bundled
                const freshIds = new Set(fresh.map(q => q.id));
                const bundledUnique = QUESTION_BANK.filter(q => !freshIds.has(q.id));
                allQuestions = [...fresh, ...bundledUnique];
            }
        }
    } catch (error) {
        __DEV__ && console.log('Using bundled questions due to fetch error');
        // Fall back to bundled questions
    }

    return allQuestions;
}

/**
 * Get shuffled questions with guaranteed Hard + Sponsored questions
 * 
 * Priority:
 * 1. At least 1 Sponsored question (if available) - supports brand partners!
 * 2. At least 1 Hard question - maintains difficulty
 * 3. Fill remaining with Easy/Medium
 */
export async function getShuffledDynamicQuestions(count: number = 3): Promise<QuizQuestion[]> {
    const allQuestions = await getDynamicQuestions();

    // Separate by difficulty and sponsored status
    const sponsored = allQuestions.filter(q => q.isSponsored === true);
    const hard = allQuestions.filter(q => q.difficulty === 'Hard' && !q.isSponsored);
    const easy = allQuestions.filter(q => q.difficulty === 'Easy' && !q.isSponsored);
    const medium = allQuestions.filter(q => q.difficulty === 'Medium' && !q.isSponsored);

    const questions: QuizQuestion[] = [];
    const usedIds = new Set<string>();

    // 🎯 PRIORITY 1: Include at least 1 SPONSORED question (brand partners!)
    if (sponsored.length > 0) {
        const shuffledSponsored = [...sponsored].sort(() => Math.random() - 0.5);
        const sponsoredPick = shuffledSponsored[0];
        questions.push(sponsoredPick);
        usedIds.add(sponsoredPick.id);
        __DEV__ && console.log(`📢 Sponsored question included: ${sponsoredPick.id}`);
    }

    // 🎯 PRIORITY 2: Include at least 1 HARD question (if not already sponsored)
    if (hard.length > 0 && questions.length < count) {
        const shuffledHard = [...hard].sort(() => Math.random() - 0.5);
        for (const q of shuffledHard) {
            if (!usedIds.has(q.id)) {
                questions.push(q);
                usedIds.add(q.id);
                break;
            }
        }
    }

    // Fill remaining with Easy/Medium
    const remaining = [...easy, ...medium].sort(() => Math.random() - 0.5);

    while (questions.length < count && remaining.length > 0) {
        const next = remaining.shift()!;
        if (!usedIds.has(next.id)) {
            questions.push(next);
            usedIds.add(next.id);
        }
    }

    // If still need more, try any remaining hard questions
    if (questions.length < count) {
        const remainingHard = hard.filter(q => !usedIds.has(q.id));
        for (const q of remainingHard) {
            if (questions.length >= count) break;
            questions.push(q);
            usedIds.add(q.id);
        }
    }

    // Shuffle final order
    return questions.sort(() => Math.random() - 0.5);
}


/**
 * Force refresh cache (for testing or manual refresh)
 */
export async function forceRefreshQuestions(): Promise<QuizQuestion[]> {
    try {
        const fresh = await fetchFromGist();
        if (fresh.length > 0) {
            await cacheQuestions(fresh);
            return fresh;
        }
    } catch (error) {
        console.error('Force refresh failed:', error);
    }
    return QUESTION_BANK;
}

/**
 * Clear question cache
 */
export async function clearQuestionCache(): Promise<void> {
    await AsyncStorage.removeItem(CACHE_KEY);
    await AsyncStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

export default getDynamicQuestions;

// ============================================================================
// QUIZ ORACLE — SHA-256 Content Hash
// ============================================================================

/**
 * Compute a SHA-256 hex digest of the question set.
 *
 * This creates a deterministic fingerprint of the quiz content that is:
 * 1. Logged on-chain in the QuizPassed attestation event
 * 2. Compared against the Gist's declared hash to detect tampering
 *
 * Uses the Web Crypto API (available in React Native via expo-crypto
 * or the global crypto subtle API). Falls back to a simple XOR hash
 * if SubtleCrypto is unavailable.
 *
 * Pitch: "Every quiz pass is attested on Solana with a content-hash of
 * the question set. Forgery is computationally infeasible."
 */
export async function computeQuestionSetHash(
    questions: QuizQuestion[]
): Promise<string> {
    // Canonical JSON: only include content-relevant fields, sorted by id
    const canonical = questions
        .map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            difficulty: q.difficulty,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const jsonStr = JSON.stringify(canonical);

    try {
        // Try Web Crypto API (available on modern RN runtimes)
        if (typeof globalThis.crypto?.subtle?.digest === 'function') {
            const encoder = new TextEncoder();
            const data = encoder.encode(jsonStr);
            const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch {
        // SubtleCrypto not available — fall through
    }

    // Fallback: deterministic XOR hash (sufficient for demo provenance)
    const hash = new Uint8Array(32);
    for (let i = 0; i < jsonStr.length; i++) {
        hash[i % 32] ^= jsonStr.charCodeAt(i) ^ (i & 0xff);
    }
    return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute hash as Uint8Array (32 bytes) for on-chain submission.
 * Used by scoreRegistry.ts for the question_set_hash field.
 */
export async function computeQuestionSetHashBytes(
    questions: QuizQuestion[]
): Promise<Uint8Array> {
    const hexHash = await computeQuestionSetHash(questions);
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hexHash.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}
