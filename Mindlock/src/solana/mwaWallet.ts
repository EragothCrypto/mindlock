/**
 * MWA Wallet Helper - Mobile Wallet Adapter Integration
 * 
 * Provides helper functions to sign and send transactions
 * using Solana Mobile's Mobile Wallet Adapter (MWA).
 * Works with Seed Vault on Seeker devices.
 */

import { Transaction, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { NETWORK_CONFIG } from '../config/network';

// App identity for MWA authorization
const APP_IDENTITY = {
    name: 'Mindlock',
    uri: 'https://mindlock.app',
    icon: 'favicon.ico',
};

export interface MWASignResult {
    success: boolean;
    signature?: string;
    error?: string;
    publicKey?: PublicKey;
}

export interface MWAAuthResult {
    success: boolean;
    publicKey?: PublicKey;
    error?: string;
}

/**
 * Connect wallet and get authorized public key via MWA
 */
export async function mwaConnect(): Promise<MWAAuthResult> {
    try {
        let resultPublicKey: PublicKey | undefined;

        await transact(async (wallet) => {
            const authResult = await wallet.authorize({
                cluster: NETWORK_CONFIG.network,
                identity: APP_IDENTITY,
            });

            if (authResult.accounts && authResult.accounts.length > 0) {
                resultPublicKey = new PublicKey(authResult.accounts[0].address);
            }
        });

        if (resultPublicKey) {
            return { success: true, publicKey: resultPublicKey };
        }
        return { success: false, error: 'No accounts returned' };
    } catch (error) {
        console.error('MWA connect error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
        };
    }
}

/**
 * Sign and send a transaction using MWA
 * 
 * This triggers the Seed Vault biometric prompt for transaction approval.
 */
export async function mwaSignAndSend(
    transaction: Transaction | VersionedTransaction,
    userPublicKey: PublicKey,
): Promise<MWASignResult> {
    try {
        let signatures: string[] = [];

        await transact(async (wallet) => {
            // Reauthorize for this session
            const authResult = await wallet.authorize({
                cluster: NETWORK_CONFIG.network,
                identity: APP_IDENTITY,
            });

            if (!authResult.accounts || authResult.accounts.length === 0) {
                throw new Error('No authorized accounts');
            }

            // Sign and send the transaction
            const txSignatures = await wallet.signAndSendTransactions({
                transactions: [transaction],
            });

            signatures = txSignatures;
        });

        if (signatures.length > 0) {
            __DEV__ && console.log('🎉 Transaction sent:', signatures[0]);
            return { success: true, signature: signatures[0], publicKey: userPublicKey };
        }

        return { success: false, error: 'No signature returned' };
    } catch (error) {
        console.error('MWA sign error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Transaction failed',
        };
    }
}

/**
 * Sign a transaction (but don't send - for pre-signing)
 */
export async function mwaSignTransaction(
    transaction: Transaction,
    _userPublicKey: PublicKey,
): Promise<Transaction> {
    let signedTx: Transaction | null = null;

    await transact(async (wallet) => {
        // Reauthorize for this session
        await wallet.authorize({
            cluster: NETWORK_CONFIG.network,
            identity: APP_IDENTITY,
        });

        // Sign the transaction
        const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
        });

        if (signedTransactions.length > 0) {
            signedTx = signedTransactions[0] as Transaction;
        }
    });

    if (!signedTx) {
        throw new Error('Transaction signing failed');
    }

    return signedTx;
}

/**
 * Create a sign function compatible with redistributionAgent
 * 
 * Returns a function that signs transactions using MWA.
 * This can be passed to processLazyUnlock().
 */
export function createMWASigner(userPublicKey: PublicKey) {
    return async (transaction: Transaction): Promise<Transaction> => {
        return mwaSignTransaction(transaction, userPublicKey);
    };
}

export default {
    mwaConnect,
    mwaSignAndSend,
    mwaSignTransaction,
    createMWASigner,
};
