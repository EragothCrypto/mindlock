/**
 * Jito Bundle Client — MEV-Protected Transaction Submission
 *
 * Wraps Mindlock's on-chain transactions (Lazy Unlock, Day Pass) in Jito
 * Bundles for:
 *   1. Atomic execution — charity + scholarship transfers land together or not at all
 *   2. MEV protection — bundle contents are private until the block lands
 *   3. Priority landing — tip incentivizes validators to include the bundle
 *
 * Works on mainnet via Block Engine. On devnet, falls back to standard
 * sendRawTransaction (Jito doesn't run a public devnet Block Engine).
 *
 * Docs: https://docs.jito.wtf
 * SDK:  https://github.com/jito-labs/jito-ts
 */

import {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';

// ============================================================================
// JITO BLOCK ENGINE ENDPOINTS
// ============================================================================

/**
 * Regional Block Engine endpoints (mainnet only).
 * Select the closest region for lowest latency.
 */
const BLOCK_ENGINE_URLS: Record<string, string> = {
    'mainnet-amsterdam': 'https://amsterdam.mainnet.block-engine.jito.wtf',
    'mainnet-frankfurt':  'https://frankfurt.mainnet.block-engine.jito.wtf',
    'mainnet-ny':         'https://ny.mainnet.block-engine.jito.wtf',
    'mainnet-tokyo':      'https://tokyo.mainnet.block-engine.jito.wtf',
    'mainnet-default':    'https://mainnet.block-engine.jito.wtf',
};

/** Default Block Engine endpoint */
const DEFAULT_BLOCK_ENGINE = BLOCK_ENGINE_URLS['mainnet-default'];

/** Bundle API path */
const BUNDLE_API_PATH = '/api/v1/bundles';

// ============================================================================
// TIP CONFIGURATION
// ============================================================================

/**
 * Known Jito tip accounts — validators pick one per slot.
 * In production, use getTipAccounts() to fetch dynamically.
 * These are the 8 well-known tip accounts as of 2026.
 */
const KNOWN_TIP_ACCOUNTS: PublicKey[] = [
    new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    new PublicKey('HFqU5x63VTqvQss8hp11i4bPgKNIzBHTPiur1BRaqGYJ'),
    new PublicKey('Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY'),
    new PublicKey('ADaUMid9yfUytqMBgopwjb2DTLSLGcHCcBJxjFqYN53W'),
    new PublicKey('DfXygSm4jCyNCzbzSmJhkJ2ttYwLJ5EtI5WofGJwQSr5'),
    new PublicKey('ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt'),
    new PublicKey('DttWaMuVvTiduZRnGuFtPJF08hXHBMPHXDkfYfMRzWM5'),
    new PublicKey('3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'),
];

/**
 * Default tip amount in SOL.
 * 0.0001 SOL (~$0.015) is sufficient for consumer transactions.
 * The tip goes to the validator as an incentive to include the bundle.
 */
const DEFAULT_TIP_LAMPORTS = 100_000; // 0.0001 SOL

/**
 * Minimum tip — below this, validators may ignore the bundle.
 */
const MIN_TIP_LAMPORTS = 10_000; // 0.00001 SOL

// ============================================================================
// TYPES
// ============================================================================

export interface JitoBundleResult {
    /** Whether the bundle was submitted via Jito Block Engine */
    usedJito: boolean;
    /** Transaction signature (from the first/only tx in the bundle) */
    txSignature: string;
    /** Jito bundle ID (returned by Block Engine, null if fallback used) */
    bundleId: string | null;
    /** Tip amount in lamports (0 if fallback used) */
    tipLamports: number;
}

export interface JitoBundleOptions {
    /** Tip amount in lamports (default: 100_000 = 0.0001 SOL) */
    tipLamports?: number;
    /** Block Engine endpoint override */
    blockEngineUrl?: string;
    /** Skip Jito and use standard sendRawTransaction */
    forceStandard?: boolean;
}

// ============================================================================
// JITO BUNDLE CLIENT
// ============================================================================

class JitoBundleClient {
    private connection: Connection;

    constructor() {
        this.connection = new Connection(NETWORK_CONFIG.rpcUrl, 'confirmed');
    }

    /**
     * Whether Jito bundles are available on the current network.
     * Jito Block Engine only runs on mainnet — devnet uses standard submission.
     */
    get isAvailable(): boolean {
        return NETWORK_CONFIG.network === 'mainnet-beta';
    }

    /**
     * Get a random tip account to reduce slot contention.
     * In production, call getTipAccounts() RPC for the latest list.
     */
    getRandomTipAccount(): PublicKey {
        const index = Math.floor(Math.random() * KNOWN_TIP_ACCOUNTS.length);
        return KNOWN_TIP_ACCOUNTS[index];
    }

    /**
     * Fetch tip accounts dynamically from the Block Engine.
     * Falls back to known tip accounts on failure.
     */
    async getTipAccounts(blockEngineUrl?: string): Promise<PublicKey[]> {
        try {
            const url = blockEngineUrl || DEFAULT_BLOCK_ENGINE;
            const response = await fetch(`${url}${BUNDLE_API_PATH}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTipAccounts',
                    params: [],
                }),
            });

            const data = await response.json();
            if (data.result && Array.isArray(data.result)) {
                return data.result.map((addr: string) => new PublicKey(addr));
            }
        } catch (error) {
            __DEV__ && console.log('Jito getTipAccounts failed, using known accounts:', error);
        }

        return KNOWN_TIP_ACCOUNTS;
    }

    /**
     * Create a tip instruction to include in a bundle.
     *
     * The tip is a simple SOL transfer from the user to a randomly
     * selected Jito tip account. It incentivizes validators to include
     * the bundle in their block.
     */
    createTipInstruction(
        payer: PublicKey,
        tipLamports: number = DEFAULT_TIP_LAMPORTS,
    ) {
        const tipAccount = this.getRandomTipAccount();

        return {
            instruction: SystemProgram.transfer({
                fromPubkey: payer,
                toPubkey: tipAccount,
                lamports: Math.max(tipLamports, MIN_TIP_LAMPORTS),
            }),
            tipAccount,
            tipLamports: Math.max(tipLamports, MIN_TIP_LAMPORTS),
        };
    }

    /**
     * Send a signed transaction as a Jito Bundle.
     *
     * On mainnet: submits to Jito Block Engine for atomic, MEV-protected execution.
     * On devnet:  falls back to standard sendRawTransaction (with tip instruction still
     *             included for demo fidelity — the tip just goes to a regular account).
     *
     * @param signedTransaction - A fully signed Transaction (including tip ix)
     * @param options - Bundle submission options
     * @returns JitoBundleResult with signature and bundle metadata
     */
    async sendBundle(
        signedTransaction: Transaction,
        options: JitoBundleOptions = {},
    ): Promise<JitoBundleResult> {
        const {
            tipLamports = DEFAULT_TIP_LAMPORTS,
            blockEngineUrl = DEFAULT_BLOCK_ENGINE,
            forceStandard = false,
        } = options;

        const serializedTx = signedTransaction.serialize();

        // ── Devnet / Forced Standard Path ────────────────────────────
        if (!this.isAvailable || forceStandard) {
            __DEV__ && console.log('📦 Jito: using standard submission (devnet/forced)');

            const txSignature = await this.connection.sendRawTransaction(serializedTx, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
            });

            return {
                usedJito: false,
                txSignature,
                bundleId: null,
                tipLamports: 0,
            };
        }

        // ── Mainnet Jito Bundle Path ─────────────────────────────────
        __DEV__ && console.log(`📦 Jito: submitting bundle to ${blockEngineUrl}`);

        const encodedTx = Buffer.from(serializedTx).toString('base64');

        try {
            const response = await fetch(`${blockEngineUrl}${BUNDLE_API_PATH}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'sendBundle',
                    params: [[encodedTx]],
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(`Jito sendBundle error: ${JSON.stringify(data.error)}`);
            }

            const bundleId = data.result as string;
            __DEV__ && console.log(`📦 Jito bundle submitted: ${bundleId}`);

            // Extract the tx signature from the signed transaction
            const txSignature = signedTransaction.signature
                ? Buffer.from(signedTransaction.signature).toString('base64')
                : bundleId;

            return {
                usedJito: true,
                txSignature,
                bundleId,
                tipLamports,
            };
        } catch (error) {
            // Fallback to standard submission if Block Engine is unreachable
            console.warn('Jito bundle submission failed, falling back to standard:', error);

            const txSignature = await this.connection.sendRawTransaction(serializedTx, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
            });

            return {
                usedJito: false,
                txSignature,
                bundleId: null,
                tipLamports: 0,
            };
        }
    }

    /**
     * Check the status of a submitted bundle.
     */
    async getBundleStatus(
        bundleId: string,
        blockEngineUrl: string = DEFAULT_BLOCK_ENGINE,
    ): Promise<{ status: string; landedSlot?: number } | null> {
        try {
            const response = await fetch(`${blockEngineUrl}${BUNDLE_API_PATH}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBundleStatuses',
                    params: [[bundleId]],
                }),
            });

            const data = await response.json();
            if (data.result?.value?.[0]) {
                return {
                    status: data.result.value[0].confirmation_status,
                    landedSlot: data.result.value[0].slot,
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Format tip amount for display.
     */
    formatTip(lamports: number): string {
        const sol = lamports / LAMPORTS_PER_SOL;
        if (sol < 0.001) {
            return `${lamports} lamports`;
        }
        return `${sol.toFixed(4)} SOL`;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const jitoBundleClient = new JitoBundleClient();
export default jitoBundleClient;
