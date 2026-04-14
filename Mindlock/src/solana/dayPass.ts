/**
 * Day Pass - "Emergency Break" Feature
 * 
 * A premium escape valve that allows users to bypass the Warden for 24 hours,
 * with a 7-day NTP-secured cooldown to prevent abuse.
 * 
 * Features:
 * - 500 $SKR price (~$7.50)
 * - 50% Charity / 50% Scholarship split
 * - 24h Shield Mode
 * - Streak frozen (not broken)
 * - NTP time prevents clock manipulation
 */

import { NativeModules, Platform } from 'react-native';
import { PublicKey, Transaction, Connection } from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { SKR_TOKEN_MINT, SKR_DECIMALS, jupiterSwap } from './jupiterSwap';
import { jitoBundleClient } from './jitoBundle';
import { NETWORK_CONFIG } from '../config/network';
import { karmaTracker } from './karmaTracker';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Day Pass price in USD */
export const DAY_PASS_PRICE_USD = 7.50;

/** Fund split for Day Pass (higher charity impact!) */
export const DAY_PASS_SPLIT = {
    CHARITY: 50,      // 50% to charity
    SCHOLARSHIP: 50,  // 50% to scholarship
};

/** Duration in milliseconds */
export const DAY_PASS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Cooldown in milliseconds */
export const DAY_PASS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Last hour threshold (triggers red countdown) */
export const LAST_HOUR_MS = 60 * 60 * 1000;

// Wallet addresses
const CHARITY_WALLET = new PublicKey('AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1'); // Mindlock Charity Wallet
const SCHOLARSHIP_WALLET = new PublicKey('7YdT4jqKmvT3vhZsQk9xMHb5x7fVj6hq2K8pNWaJcDRf');

// ============================================================================
// INTERFACE
// ============================================================================

export interface DayPassStatus {
    isShieldActive: boolean;
    shieldRemainingMs: number;
    isLastHour: boolean;
    streakFrozen: boolean;
    canPurchase: boolean;
    cooldownRemainingMs: number;
}

export interface DayPassResult {
    success: boolean;
    shieldActive: boolean;
    expiresAt: number;
    txSignature?: string;
    error?: string;
}

// ============================================================================
// NATIVE MODULE BRIDGE
// ============================================================================

const DayPassNative = NativeModules.DayPassModule;

/**
 * Get current Day Pass status from native module
 */
async function getNativeStatus(): Promise<DayPassStatus> {
    if (Platform.OS !== 'android' || !DayPassNative) {
        // Fallback for iOS / testing
        return {
            isShieldActive: false,
            shieldRemainingMs: 0,
            isLastHour: false,
            streakFrozen: false,
            canPurchase: true,
            cooldownRemainingMs: 0,
        };
    }

    const status = await DayPassNative.getStatus();
    return {
        isShieldActive: status.isShieldActive,
        shieldRemainingMs: status.shieldRemainingMs,
        isLastHour: status.isLastHour,
        streakFrozen: status.streakFrozen,
        canPurchase: status.canPurchase,
        cooldownRemainingMs: status.cooldownRemainingMs,
    };
}

/**
 * Activate Day Pass via native module
 */
async function activateNative(): Promise<{ activated: boolean; expiresAt: number }> {
    if (Platform.OS !== 'android' || !DayPassNative) {
        const expiresAt = Date.now() + DAY_PASS_DURATION_MS;
        return { activated: true, expiresAt };
    }

    const result = await DayPassNative.activateDayPass();
    return {
        activated: result.activated,
        expiresAt: result.expiresAt,
    };
}

// ============================================================================
// DAY PASS CLASS
// ============================================================================

class DayPassManager {
    private connection: Connection;

    constructor() {
        this.connection = new Connection(NETWORK_CONFIG.rpcUrl, 'confirmed');
    }

    /**
     * Get current Day Pass status
     */
    async getStatus(): Promise<DayPassStatus> {
        return getNativeStatus();
    }

    /**
     * Check if Shield Mode is active
     */
    async isShieldActive(): Promise<boolean> {
        const status = await this.getStatus();
        return status.isShieldActive;
    }

    /**
     * Check if Day Pass can be purchased (7-day cooldown passed)
     */
    async canPurchase(): Promise<boolean> {
        const status = await this.getStatus();
        return status.canPurchase;
    }

    /**
     * Get estimated $SKR price for Day Pass
     */
    async getPrice(): Promise<{ skrAmount: number; usdValue: number; formattedSkr: string }> {
        const skrPrice = await jupiterSwap.getSkrPriceInUsd();
        const skrAmount = DAY_PASS_PRICE_USD / skrPrice;

        return {
            skrAmount: Math.ceil(skrAmount),
            usdValue: DAY_PASS_PRICE_USD,
            formattedSkr: `${Math.ceil(skrAmount)} $SKR`,
        };
    }

    /**
     * Purchase Day Pass
     * 
     * Flow:
     * 1. Check cooldown (7 days)
     * 2. Create transfer transaction (50/50 split)
     * 3. Sign with MWA
     * 4. Activate native shield mode
     * 5. Freeze streak
     */
    async purchaseDayPass(
        userPublicKey: PublicKey,
        signTransaction: (tx: Transaction) => Promise<Transaction>,
    ): Promise<DayPassResult> {
        try {
            // 1. Check cooldown
            const canBuy = await this.canPurchase();
            if (!canBuy) {
                const status = await this.getStatus();
                const daysRemaining = Math.ceil(status.cooldownRemainingMs / (1000 * 60 * 60 * 24));
                return {
                    success: false,
                    shieldActive: false,
                    expiresAt: 0,
                    error: `Cooldown active. Try again in ${daysRemaining} days.`,
                };
            }

            __DEV__ && console.log('🛡️ Purchasing Day Pass...');

            // 2. Get price
            const price = await this.getPrice();
            __DEV__ && console.log(`   Price: ${price.formattedSkr} (~$${price.usdValue})`);

            // 3. Calculate split amounts
            const charityAmount = Math.floor(price.skrAmount * DAY_PASS_SPLIT.CHARITY / 100);
            const scholarshipAmount = price.skrAmount - charityAmount;

            __DEV__ && console.log(`   Split: ${charityAmount} charity / ${scholarshipAmount} scholarship`);

            // 4. Get token accounts
            const userSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                userPublicKey
            );

            const charitySkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                CHARITY_WALLET
            );

            const scholarshipSkrAccount = await getAssociatedTokenAddress(
                SKR_TOKEN_MINT,
                SCHOLARSHIP_WALLET
            );

            // 5. Create transfer instructions (atomic 50/50 split)
            const charityLamports = Math.floor(charityAmount * Math.pow(10, SKR_DECIMALS));
            const scholarshipLamports = Math.floor(scholarshipAmount * Math.pow(10, SKR_DECIMALS));

            const charityIx = createTransferInstruction(
                userSkrAccount,
                charitySkrAccount,
                userPublicKey,
                charityLamports,
                [],
                TOKEN_PROGRAM_ID
            );

            const scholarshipIx = createTransferInstruction(
                userSkrAccount,
                scholarshipSkrAccount,
                userPublicKey,
                scholarshipLamports,
                [],
                TOKEN_PROGRAM_ID
            );

            // 6. Build transaction
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

            const transaction = new Transaction({
                feePayer: userPublicKey,
                blockhash,
                lastValidBlockHeight,
            });

            transaction.add(charityIx, scholarshipIx);

            // 6b. Add Jito tip for MEV-protected bundle execution
            const { instruction: tipIx } = jitoBundleClient.createTipInstruction(userPublicKey);
            transaction.add(tipIx);

            // 7. Sign with MWA (biometric)
            __DEV__ && console.log('🔐 Requesting signature...');
            const signedTx = await signTransaction(transaction);

            // 8. Send via Jito Bundle (atomic, MEV-protected)
            const bundleResult = await jitoBundleClient.sendBundle(signedTx);
            const txSignature = bundleResult.txSignature;

            await this.connection.confirmTransaction({
                signature: txSignature,
                blockhash,
                lastValidBlockHeight,
            }, 'confirmed');

            __DEV__ && console.log(`✅ Day Pass payment confirmed: ${txSignature}`);

            // 9. Activate native Shield Mode
            const activation = await activateNative();

            // 10. Track as donation (for Karma, but at 50% rate)
            await karmaTracker.addDonation(
                userPublicKey.toString(),
                charityAmount,
                DAY_PASS_PRICE_USD * (DAY_PASS_SPLIT.CHARITY / 100)
            );

            __DEV__ && console.log('🛡️ SHIELD MODE ACTIVE!');
            __DEV__ && console.log(`   Expires: ${new Date(activation.expiresAt).toLocaleString()}`);

            return {
                success: true,
                shieldActive: true,
                expiresAt: activation.expiresAt,
                txSignature,
            };
        } catch (error) {
            console.error('Day Pass purchase failed:', error);
            return {
                success: false,
                shieldActive: false,
                expiresAt: 0,
                error: error instanceof Error ? error.message : 'Purchase failed',
            };
        }
    }

    /**
     * Format remaining time for display
     */
    formatTimeRemaining(ms: number): string {
        if (ms <= 0) return '0:00';

        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Format cooldown for display
     */
    formatCooldown(ms: number): string {
        if (ms <= 0) return 'Available';

        const days = Math.floor(ms / (1000 * 60 * 60 * 24));
        const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
            return `${days}d ${hours}h`;
        }
        return `${hours}h`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const dayPassManager = new DayPassManager();
export default dayPassManager;
