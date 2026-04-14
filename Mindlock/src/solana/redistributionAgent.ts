import {
    Connection,
    PublicKey,
    Transaction,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { NETWORK_CONFIG } from '../config/network';
import { jupiterSwap, SKR_TOKEN_MINT, SKR_DECIMALS } from './jupiterSwap';
import { jitoBundleClient } from './jitoBundle';
import { mindlockWarden } from '../native/MindlockWarden';
import { karmaTracker } from './karmaTracker';

// Lazy unlock fee in USD (dynamic conversion to $SKR)
export const LAZY_UNLOCK_FEE_USD = 1.50;

// ============================================================================
// FUND SPLIT CONFIGURATION
// ============================================================================

/**
 * Fund Split Percentages
 * 
 * Lazy Unlock fees are split between:
 * - Charity: Direct donation (earns Karma)
 * - Scholarship Fund: Pool for leaderboard rewards at epoch end
 */
export const FUND_SPLIT = {
    CHARITY_PERCENT: 40,      // 40% → Direct charity donation
    SCHOLARSHIP_PERCENT: 60,  // 60% → Leaderboard scholarship pool
};

// ============================================================================
// CHARITY CONFIGURATION
// ============================================================================

/**
 * Charity Wallet - 40% of Lazy Unlock fees
 * 
 * This portion goes directly to charity.
 * Users earn Karma proportional to their donations!
 */
export const CHARITY_WALLET_ADDRESS = new PublicKey(
    'AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1' // Mindlock Charity Wallet
);

// For testing on devnet
export const CHARITY_WALLET_ADDRESS_DEVNET = new PublicKey(
    'FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses'
);

// ============================================================================
// SCHOLARSHIP FUND CONFIGURATION
// ============================================================================

/**
 * Scholarship Fund Wallet - 60% of Lazy Unlock fees
 * 
 * This pool accumulates $SKR for leaderboard rewards.
 * Top learners share this fund at the end of each epoch (monthly).
 */
export const SCHOLARSHIP_WALLET_ADDRESS = new PublicKey(
    'Hq3nR7YfzpELZEgVoNjRvDe8jUeBmcpWNuNrJ1mPisqE' // Scholarship fund wallet (devnet)
);

// For testing on devnet (separate from charity for tracking)
export const SCHOLARSHIP_WALLET_ADDRESS_DEVNET = new PublicKey(
    'Hq3nR7YfzpELZEgVoNjRvDe8jUeBmcpWNuNrJ1mPisqE' // Different from charity for clear separation
);

// Active wallets (based on network)
const ACTIVE_CHARITY_WALLET = CHARITY_WALLET_ADDRESS_DEVNET;
const ACTIVE_SCHOLARSHIP_WALLET = SCHOLARSHIP_WALLET_ADDRESS_DEVNET;

interface LazyUnlockFee {
    skrAmount: number;
    usdValue: number;
    skrPrice: number;
    formattedSkr: string;
}

interface CharityDonationResult {
    success: boolean;
    skrDonated: number;
    usdValue: number;
    newKarmaScore: number;
    karmaLevel: string;
    txSignature?: string;
    error?: string;
}

/**
 * Redistribution Agent - Charity Edition 🎁
 * 
 * Lazy Unlock = Charity Donation:
 * 1. User pays $SKR to skip quiz ($1.50 USD equivalent)
 * 2. 100% of $SKR goes directly to charity wallet
 * 3. User earns "Karma" score that grows with donations
 * 4. Karma displayed on leaderboard - heroes, not slackers!
 */
export class RedistributionAgent {
    private connection: Connection;

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    /**
     * Get current lazy unlock fee in $SKR
     */
    async getLazyUnlockFee(): Promise<LazyUnlockFee> {
        const { skrAmount, usdValue, skrPrice } = await jupiterSwap.getLazyUnlockFeeSkr();

        return {
            skrAmount,
            usdValue,
            skrPrice,
            formattedSkr: `${jupiterSwap.formatSkr(skrAmount)} $SKR`,
        };
    }

    /**
     * Process a Lazy Unlock with FUND SPLIT 💝📚
     * 
     * User pays $SKR which is split:
     * - 40% → Charity (earns Karma)
     * - 60% → Scholarship Fund (leaderboard rewards)
     */
    async processLazyUnlock(
        userPublicKey: PublicKey,
        signTransaction: (tx: Transaction) => Promise<Transaction>,
    ): Promise<CharityDonationResult> {
        try {
            // 1. Get current fee in $SKR
            const fee = await this.getLazyUnlockFee();
            __DEV__ && console.log(`💝📚 Lazy Unlock: ${fee.formattedSkr} (~$${fee.usdValue.toFixed(2)} USD)`);

            // 2. Calculate split amounts
            const totalLamports = Math.floor(fee.skrAmount * Math.pow(10, SKR_DECIMALS));
            const charityLamports = Math.floor(totalLamports * FUND_SPLIT.CHARITY_PERCENT / 100);
            const scholarshipLamports = totalLamports - charityLamports; // Remainder to avoid dust

            const charitySkr = charityLamports / Math.pow(10, SKR_DECIMALS);
            const scholarshipSkr = scholarshipLamports / Math.pow(10, SKR_DECIMALS);
            const charityUsd = fee.usdValue * FUND_SPLIT.CHARITY_PERCENT / 100;

            __DEV__ && console.log(`  → Charity (${FUND_SPLIT.CHARITY_PERCENT}%): ${charitySkr.toFixed(0)} $SKR`);
            __DEV__ && console.log(`  → Scholarship (${FUND_SPLIT.SCHOLARSHIP_PERCENT}%): ${scholarshipSkr.toFixed(0)} $SKR`);

            // 3. Get user's $SKR token account
            const userSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                userPublicKey
            );

            // 4. Get destination token accounts
            const charitySkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                ACTIVE_CHARITY_WALLET
            );
            const scholarshipSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                ACTIVE_SCHOLARSHIP_WALLET
            );

            // 5. Create DUAL transfer instructions
            // Transfer 1: Charity (40%)
            const charityTransferIx = createTransferInstruction(
                userSkrAccount,
                charitySkrAccount,
                userPublicKey,
                charityLamports,
                [],
                TOKEN_PROGRAM_ID
            );

            // Transfer 2: Scholarship Fund (60%)
            const scholarshipTransferIx = createTransferInstruction(
                userSkrAccount,
                scholarshipSkrAccount,
                userPublicKey,
                scholarshipLamports,
                [],
                TOKEN_PROGRAM_ID
            );

            // 6. Build transaction with BOTH transfers
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

            const transaction = new Transaction({
                feePayer: userPublicKey,
                blockhash,
                lastValidBlockHeight,
            });

            // Add both transfers to single transaction (atomic!)
            transaction.add(charityTransferIx);
            transaction.add(scholarshipTransferIx);

            // 6b. Add Jito tip instruction for MEV-protected bundle submission
            //     On devnet: tip still goes through (to a regular account) for demo fidelity
            //     On mainnet: tip incentivizes validator to include the bundle atomically
            const { instruction: tipIx, tipLamports, tipAccount } =
                jitoBundleClient.createTipInstruction(userPublicKey);
            transaction.add(tipIx);
            __DEV__ && console.log(
                `📦 Jito tip: ${jitoBundleClient.formatTip(tipLamports)} → ${tipAccount.toBase58().slice(0, 8)}...`
            );

            // 7. Sign and send via Jito Bundle (MEV-protected, atomic)
            const signedTx = await signTransaction(transaction);
            const bundleResult = await jitoBundleClient.sendBundle(signedTx);
            const txSignature = bundleResult.txSignature;

            if (bundleResult.usedJito) {
                __DEV__ && console.log(`📦 Bundle landed: ${bundleResult.bundleId}`);
            }

            // 8. Confirm (standard RPC confirmation — works for both Jito and standard)
            await this.connection.confirmTransaction({
                signature: txSignature,
                blockhash,
                lastValidBlockHeight,
            }, 'confirmed');

            // 9. Update Karma score (based on CHARITY portion only!) 🌟
            const karmaResult = await karmaTracker.addDonation(
                userPublicKey.toString(),
                charitySkr,   // Only count charity portion for Karma
                charityUsd
            );

            // 10. Grant native unlock
            await mindlockWarden.grantTempUnlock();

            // 11. Activate Karma Boost (1.2× Focus Score for 24h!) ⚡
            const boost = await karmaTracker.activateBoost(userPublicKey.toString());

            __DEV__ && console.log(`💝 Charity: ${charitySkr.toFixed(0)} $SKR | 📚 Scholarship: ${scholarshipSkr.toFixed(0)} $SKR`);
            __DEV__ && console.log(`🌟 Karma: ${karmaResult.totalKarma} (${karmaResult.level})`);
            if (boost.activated) {
                __DEV__ && console.log(`⚡ Karma Boost activated! 1.2× Focus Score for 24h`);
            }

            return {
                success: true,
                skrDonated: fee.skrAmount,
                usdValue: fee.usdValue,
                newKarmaScore: karmaResult.totalKarma,
                karmaLevel: karmaResult.level,
                txSignature,
            };
        } catch (error) {
            console.error('Charity donation failed:', error);
            return {
                success: false,
                skrDonated: 0,
                usdValue: 0,
                newKarmaScore: 0,
                karmaLevel: 'Newcomer',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Check if user has enough $SKR for unlock
     */
    async canAffordUnlock(userPublicKey: PublicKey): Promise<{
        canAfford: boolean;
        balance: number;
        required: number;
        shortfall: number;
    }> {
        try {
            const fee = await this.getLazyUnlockFee();

            const userSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                userPublicKey
            );

            const accountInfo = await this.connection.getTokenAccountBalance(userSkrAccount);
            const balance = accountInfo.value.uiAmount || 0;
            const required = fee.skrAmount;

            return {
                canAfford: balance >= required,
                balance,
                required,
                shortfall: Math.max(0, required - balance),
            };
        } catch (error) {
            const fee = await this.getLazyUnlockFee();
            return {
                canAfford: false,
                balance: 0,
                required: fee.skrAmount,
                shortfall: fee.skrAmount,
            };
        }
    }

    /**
     * Get total charity donations
     */
    async getTotalCharityDonations(): Promise<number> {
        try {
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                ACTIVE_CHARITY_WALLET,
                { mint: SKR_TOKEN_MINT }
            );

            if (tokenAccounts.value.length === 0) {
                return 0;
            }

            const balance = tokenAccounts.value[0].account.data.parsed?.info?.tokenAmount?.uiAmount || 0;
            return balance;
        } catch (error) {
            console.error('Failed to get charity balance:', error);
            return 0;
        }
    }

    /**
     * Format balance for display
     */
    formatBalance(amount: number): string {
        if (amount >= 1_000_000) {
            return (amount / 1_000_000).toFixed(2) + 'M $SKR';
        } else if (amount >= 1_000) {
            return (amount / 1_000).toFixed(2) + 'K $SKR';
        }
        return amount.toFixed(2) + ' $SKR';
    }
}

export const redistributionAgent = new RedistributionAgent();
export default redistributionAgent;
