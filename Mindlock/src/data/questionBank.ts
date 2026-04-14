/**
 * Mindlock Knowledge Gate Question Bank
 * 
 * Curated questions with DIFFICULTY LEVELS:
 * - Easy: General knowledge
 * - Medium: Requires some ecosystem understanding
 * - Hard: Deep knowledge, must work for it!
 */

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Category = 'LST' | 'DePIN' | 'SKR' | 'Solana' | 'Mobile';

export interface QuizQuestion {
    id: string;
    category: Category;
    difficulty: Difficulty;
    question: string;
    options: string[];
    correctIndex: number;
    explanation?: string;
    /** Sponsored question - will be shown at least once per quiz */
    isSponsored?: boolean;
    /** Sponsor name/brand for display */
    sponsor?: string;
}

export const QUESTION_BANK: QuizQuestion[] = [
    // ========== EASY ==========
    {
        id: 'easy-1',
        category: 'Solana',
        difficulty: 'Easy',
        question: 'What is the native token of Solana?',
        options: ['ETH', 'SOL', 'BTC', 'AVAX'],
        correctIndex: 1,
        explanation: 'SOL is the native token of the Solana blockchain, used for transaction fees and staking.',
    },
    {
        id: 'easy-2',
        category: 'Solana',
        difficulty: 'Easy',
        question: 'What programming language are Solana programs written in?',
        options: ['JavaScript', 'Solidity', 'Rust', 'Python'],
        correctIndex: 2,
        explanation: 'Solana on-chain programs (smart contracts) are written in Rust and compiled to BPF bytecode.',
    },
    {
        id: 'easy-3',
        category: 'Mobile',
        difficulty: 'Easy',
        question: 'What was the first Solana Mobile device?',
        options: ['Seeker', 'Saga', 'Solana One', 'Phantom Phone'],
        correctIndex: 1,
        explanation: 'Saga was the first Solana Mobile device, released in 2023. Seeker is the second generation.',
    },
    {
        id: 'easy-4',
        category: 'LST',
        difficulty: 'Easy',
        question: 'What does LST stand for?',
        options: ['Low Staking Token', 'Liquid Staking Token', 'Locked Stake Transfer', 'Leverage Staking Tool'],
        correctIndex: 1,
        explanation: 'Liquid Staking Tokens let you stake SOL while keeping a tradeable receipt token (like mSOL, jitoSOL).',
    },
    {
        id: 'easy-5',
        category: 'DePIN',
        difficulty: 'Easy',
        question: 'What does DePIN stand for?',
        options: ['Decentralized Personal ID', 'Decentralized Physical Infrastructure Network', 'Digital Protocol Integration', 'Distributed Processing Node'],
        correctIndex: 1,
        explanation: 'DePIN projects build physical infrastructure (WiFi, maps, GPUs) powered by crypto incentives.',
    },

    // ========== MEDIUM ==========
    {
        id: 'med-1',
        category: 'LST',
        difficulty: 'Medium',
        question: 'Which protocol offers mSOL on Solana?',
        options: ['Lido', 'Marinade Finance', 'Jito', 'Sanctum'],
        correctIndex: 1,
        explanation: 'Marinade Finance mints mSOL when you stake SOL. It was the first major LST on Solana.',
    },
    {
        id: 'med-2',
        category: 'LST',
        difficulty: 'Medium',
        question: 'What is jitoSOL known for besides liquid staking?',
        options: ['Zero fees', 'MEV rewards distribution', 'Governance voting', 'NFT airdrops'],
        correctIndex: 1,
        explanation: 'Jito captures MEV (Maximal Extractable Value) on Solana and redistributes it to jitoSOL holders as extra yield.',
    },
    {
        id: 'med-3',
        category: 'DePIN',
        difficulty: 'Medium',
        question: 'Which DePIN project provides decentralized wireless coverage?',
        options: ['Render', 'Helium', 'Hivemapper', 'io.net'],
        correctIndex: 1,
        explanation: 'Helium\'s network of community-run hotspots provides LoRaWAN and 5G coverage incentivized by HNT tokens.',
    },
    {
        id: 'med-4',
        category: 'DePIN',
        difficulty: 'Medium',
        question: 'What does Hivemapper create using dashcams?',
        options: ['Traffic monitoring', 'Insurance claims', 'Decentralized maps', 'Vehicle tracking'],
        correctIndex: 2,
        explanation: 'Hivemapper crowdsources mapping data from drivers\' dashcams to build an open-source street-level map.',
    },
    {
        id: 'med-5',
        category: 'SKR',
        difficulty: 'Medium',
        question: 'What is $SKR in the Solana Mobile ecosystem?',
        options: ['A stablecoin', 'Seeker token for device rewards', 'Governance token for validators', 'Wrapped SOL token'],
        correctIndex: 1,
        explanation: '$SKR (Seeker Rewards) is the token distributed to Solana Seeker device owners as part of the mobile rewards program.',
    },
    {
        id: 'med-6',
        category: 'Mobile',
        difficulty: 'Medium',
        question: 'What is the Seed Vault on Solana Mobile devices?',
        options: ['Cloud backup', 'Secure element for private keys', 'NFT storage app', 'Hardware wallet accessory'],
        correctIndex: 1,
        explanation: 'Seed Vault is a hardware-backed secure element on Seeker that stores private keys behind biometric authentication.',
    },
    {
        id: 'med-7',
        category: 'Solana',
        difficulty: 'Medium',
        question: 'What framework is used to build Solana programs?',
        options: ['Hardhat', 'Foundry', 'Anchor', 'Truffle'],
        correctIndex: 2,
        explanation: 'Anchor is the Solana development framework that simplifies on-chain program creation with Rust macros and IDL generation.',
    },

    // ========== HARD (Must work for TikTok time!) ==========
    {
        id: 'hard-1',
        category: 'LST',
        difficulty: 'Hard',
        question: 'What does Sanctum enable for LSTs on Solana?',
        options: ['Cross-chain bridging', 'Unified liquidity and instant LST swaps', 'NFT collateralization', 'Governance proposals'],
        correctIndex: 1,
        explanation: 'Sanctum\'s Infinity Pool enables instant swaps between any LSTs.',
    },
    {
        id: 'hard-2',
        category: 'SKR',
        difficulty: 'Hard',
        question: 'What is a "Guardian" in the $SKR staking system?',
        options: ['A hardware wallet', 'A validator node', 'A staking delegation position', 'A security audit firm'],
        correctIndex: 2,
        explanation: 'Guardians are delegation positions in the $SKR staking meta.',
    },
    {
        id: 'hard-3',
        category: 'SKR',
        difficulty: 'Hard',
        question: 'What grace period bonus does delegating $SKR provide in Mindlock?',
        options: ['Free SOL airdrops', '45 minutes instead of 30', 'Unlimited access', 'NFT rewards'],
        correctIndex: 1,
        explanation: 'Guardian delegators get 45min grace vs 30min default.',
    },
    {
        id: 'hard-4',
        category: 'DePIN',
        difficulty: 'Hard',
        question: 'What physical infrastructure does Render Network leverage?',
        options: ['WiFi routers', 'Distributed GPUs', 'Solar panels', 'Storage drives'],
        correctIndex: 1,
        explanation: 'Render uses distributed GPU power for 3D rendering.',
    },
    {
        id: 'hard-5',
        category: 'Solana',
        difficulty: 'Hard',
        question: 'What consensus innovation does Solana use alongside Proof of Stake?',
        options: ['Proof of Work', 'Proof of History', 'Proof of Authority', 'Proof of Space'],
        correctIndex: 1,
        explanation: 'Proof of History creates a cryptographic clock for ordering.',
    },
    {
        id: 'hard-6',
        category: 'DePIN',
        difficulty: 'Hard',
        question: 'Which DePIN project focuses on decentralized GPU compute for AI?',
        options: ['Helium', 'Render', 'io.net', 'Nosana'],
        correctIndex: 2,
        explanation: 'io.net aggregates GPU power for AI/ML workloads.',
    },
    {
        id: 'hard-7',
        category: 'LST',
        difficulty: 'Hard',
        question: 'What is the main innovation of Jito\'s MEV infrastructure?',
        options: ['Block production', 'MEV redistribution to stakers', 'Private transactions', 'Cross-chain bridges'],
        correctIndex: 1,
        explanation: 'Jito captures MEV and redistributes it to jitoSOL holders.',
    },
    {
        id: 'hard-8',
        category: 'Mobile',
        difficulty: 'Hard',
        question: 'What protocol connects mobile dApps to wallets on Solana?',
        options: ['WalletConnect', 'Mobile Wallet Adapter (MWA)', 'Phantom Connect', 'Solana Bridge'],
        correctIndex: 1,
        explanation: 'MWA is Solana Mobile\'s protocol for dApp-wallet communication.',
    },
];

/**
 * Get shuffled questions with guaranteed difficulty distribution
 * For the "Banger" mode: 3 questions with at least 1 Hard
 */
export function getShuffledQuestions(count: number = 3): QuizQuestion[] {
    const easy = QUESTION_BANK.filter(q => q.difficulty === 'Easy');
    const medium = QUESTION_BANK.filter(q => q.difficulty === 'Medium');
    const hard = QUESTION_BANK.filter(q => q.difficulty === 'Hard');

    const questions: QuizQuestion[] = [];

    // MUST include at least 1 Hard question - make them work for TikTok!
    const shuffledHard = [...hard].sort(() => Math.random() - 0.5);
    questions.push(shuffledHard[0]);

    // Fill remaining slots with mix of Easy/Medium
    const remaining = [...easy, ...medium].sort(() => Math.random() - 0.5);

    while (questions.length < count && remaining.length > 0) {
        const next = remaining.shift()!;
        if (!questions.find(q => q.id === next.id)) {
            questions.push(next);
        }
    }

    // Shuffle final order so Hard isn't always last
    return questions.sort(() => Math.random() - 0.5);
}

/**
 * Get questions from specific categories
 */
export function getQuestionsByCategory(
    categories: Category[],
    count: number = 3
): QuizQuestion[] {
    const filtered = QUESTION_BANK.filter(q => categories.includes(q.category));
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Legacy function for backward compatibility
 */
export function getRandomQuestions(count: number = 5): QuizQuestion[] {
    const shuffled = [...QUESTION_BANK].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Get balanced mix (used in 5-question mode)
 */
export function getBalancedQuestions(count: number = 5): QuizQuestion[] {
    return getShuffledQuestions(count);
}
