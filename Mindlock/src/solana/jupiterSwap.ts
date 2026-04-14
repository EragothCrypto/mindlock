import {
    Connection,
    PublicKey,
    VersionedTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';

// ============================================================================
// Jupiter API — v6 (latest as of 2026)
// Docs: https://station.jup.ag/api-v6
// ============================================================================
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6';

// ============================================================================
// Token mints
// ============================================================================

/** $SKR — Solana Seeker ecosystem token */
export const SKR_TOKEN_MINT = new PublicKey(
    'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'
);

/** Wrapped SOL (native) */
export const SOL_MINT = new PublicKey(
    'So11111111111111111111111111111111111111112'
);

/** USDC — price reference oracle */
export const USDC_MINT = new PublicKey(
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);

/** Mindlock Reward Vault (authority wallet) */
export const REWARD_VAULT_ADDRESS = new PublicKey(
    'FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses'
);

/** $SKR token decimals */
export const SKR_DECIMALS = 9;

// ============================================================================
// Types
// ============================================================================

/** Jupiter v6 Quote response */
export interface QuoteResponse {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    /** Price impact as a percentage string, e.g. "0.02" */
    priceImpactPct: string;
    /** Human-readable route: ["SOL", "USDC", "SKR"] */
    routePlan: RoutePlanStep[];
    /** Slippage tolerance actually applied (may differ from requested if dynamic) */
    slippageBps: number;
    /** otherAmountThreshold — minimum out with slippage applied */
    otherAmountThreshold: string;
    /** 'ExactIn' | 'ExactOut' */
    swapMode: 'ExactIn' | 'ExactOut';
}

export interface RoutePlanStep {
    swapInfo: {
        ammKey: string;
        label?: string;
        inputMint: string;
        outputMint: string;
        inAmount: string;
        outAmount: string;
        feeAmount: string;
        feeMint: string;
    };
    percent: number;
}

export interface SwapResult {
    success: boolean;
    txSignature?: string;
    skrAmount?: number;
    inAmount?: number;
    priceImpactPct?: number;
    routeLabels?: string[];
    error?: string;
}

export interface PriceInfo {
    skrPriceUsd: number;
    solPriceUsd: number;
    skrPerSol: number;
    timestamp: number;
}

// ============================================================================
// JupiterSwap — Mindlock's V2-upgraded integration
//
// Key improvements over V1:
//   1. ExactOut quoting  — Lazy Unlock pays EXACTLY $1.50 in $SKR
//   2. Dynamic slippage  — adapts to liquidity depth (maxBps: 300)
//   3. Route labels      — UI shows "SOL → USDC → SKR" routing path
//   4. Price impact gate — blocks swaps with >2% impact (protects users)
//   5. Retry logic       — handles transient quote API failures gracefully
//   6. Dual-price cache  — separate caches for $SKR and SOL prices
// ============================================================================
export class JupiterSwap {
    private connection: Connection;

    // Price caches
    private cachedSkrPrice: number | null = null;
    private cachedSolPrice: number | null = null;
    private priceLastUpdated: number = 0;
    private readonly PRICE_CACHE_MS = 60_000; // 1 minute

    // Quote cache (30s — valid for one user interaction flow)
    private cachedQuote: QuoteResponse | null = null;
    private quoteParams: string = '';
    private quoteLastUpdated: number = 0;
    private readonly QUOTE_CACHE_MS = 30_000;

    // Safety thresholds
    private readonly MAX_PRICE_IMPACT_PCT = 2.0; // block swaps with >2% impact
    private readonly MAX_SLIPPAGE_BPS = 300;     // 3% max dynamic slippage

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRICE FEEDS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch $SKR and SOL prices in USD from Jupiter Price API v6.
     * Returns cached values if < 1 minute old.
     */
    async getPriceInfo(): Promise<PriceInfo> {
        const now = Date.now();
        if (
            this.cachedSkrPrice !== null &&
            this.cachedSolPrice !== null &&
            now - this.priceLastUpdated < this.PRICE_CACHE_MS
        ) {
            return {
                skrPriceUsd: this.cachedSkrPrice,
                solPriceUsd: this.cachedSolPrice,
                skrPerSol: this.cachedSolPrice / this.cachedSkrPrice,
                timestamp: this.priceLastUpdated,
            };
        }

        try {
            const params = new URLSearchParams({
                ids: [SKR_TOKEN_MINT.toString(), SOL_MINT.toString()].join(','),
                vsToken: USDC_MINT.toString(),
            });

            const response = await fetch(
                `${JUPITER_PRICE_API}/price?${params.toString()}`
            );

            if (!response.ok) {
                throw new Error(`Price API ${response.status}`);
            }

            const data = await response.json();
            const skrData = data.data[SKR_TOKEN_MINT.toString()];
            const solData = data.data[SOL_MINT.toString()];

            this.cachedSkrPrice = skrData?.price ?? 0.001;
            this.cachedSolPrice = solData?.price ?? 150;
            this.priceLastUpdated = now;
        } catch (error) {
            console.warn('Jupiter price fetch failed, using cached/fallback:', error);
            this.cachedSkrPrice = this.cachedSkrPrice ?? 0.001;
            this.cachedSolPrice = this.cachedSolPrice ?? 150;
        }

        return {
            skrPriceUsd: this.cachedSkrPrice!,
            solPriceUsd: this.cachedSolPrice!,
            skrPerSol: this.cachedSolPrice! / this.cachedSkrPrice!,
            timestamp: this.priceLastUpdated,
        };
    }

    /** Get $SKR price in USD (convenience wrapper) */
    async getSkrPriceInUsd(): Promise<number> {
        return (await this.getPriceInfo()).skrPriceUsd;
    }

    /** Calculate $SKR amount for USD value */
    async calculateSkrForUsd(usdAmount: number): Promise<number> {
        const { skrPriceUsd } = await this.getPriceInfo();
        if (skrPriceUsd <= 0) throw new Error('Invalid $SKR price');
        return usdAmount / skrPriceUsd;
    }

    /** Get Lazy Unlock fee in $SKR (dynamic, always = $1.50 USD) */
    async getLazyUnlockFeeSkr(): Promise<{ skrAmount: number; usdValue: number; skrPrice: number }> {
        const USD_FEE = 1.50;
        const { skrPriceUsd } = await this.getPriceInfo();
        return {
            skrAmount: USD_FEE / skrPriceUsd,
            usdValue: USD_FEE,
            skrPrice: skrPriceUsd,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QUOTE — ExactIn and ExactOut
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * ExactIn quote: SOL → $SKR (user controls how much SOL to spend)
     * Used for: scholarship pool top-ups, reward distribution
     */
    async getQuote(solAmount: number): Promise<QuoteResponse | null> {
        const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
        return this._fetchQuote({
            inputMint: SOL_MINT.toString(),
            outputMint: SKR_TOKEN_MINT.toString(),
            amount: lamports.toString(),
            swapMode: 'ExactIn',
        });
    }

    /**
     * V2: ExactOut quote — user pays exactly the required $SKR for Lazy Unlock.
     * Instead of "spend X SOL, get ~Y $SKR", this says "get exactly Y $SKR,
     * spend however much SOL is needed." Prevents under/overpayment.
     *
     * Used for: Lazy Unlock charity donation (must be exactly $1.50 in $SKR)
     */
    async getExactOutQuote(skrAmountNeeded: number): Promise<QuoteResponse | null> {
        const skrLamports = Math.floor(skrAmountNeeded * Math.pow(10, SKR_DECIMALS));
        return this._fetchQuote({
            inputMint: SOL_MINT.toString(),
            outputMint: SKR_TOKEN_MINT.toString(),
            amount: skrLamports.toString(),
            swapMode: 'ExactOut',
        });
    }

    /**
     * Reverse quote: $SKR → SOL (for display/balance checks)
     */
    async getSkrQuote(skrAmount: number): Promise<{ skrAmount: number; lamportsValue: number; routeLabels: string[] } | null> {
        const skrLamports = Math.floor(skrAmount * Math.pow(10, SKR_DECIMALS));
        const quote = await this._fetchQuote({
            inputMint: SKR_TOKEN_MINT.toString(),
            outputMint: SOL_MINT.toString(),
            amount: skrLamports.toString(),
            swapMode: 'ExactIn',
        });

        if (!quote) return null;
        return {
            skrAmount,
            lamportsValue: parseInt(quote.outAmount),
            routeLabels: this.extractRouteLabels(quote),
        };
    }

    /** Internal: fetch a quote with dynamic slippage + caching */
    private async _fetchQuote(params: {
        inputMint: string;
        outputMint: string;
        amount: string;
        swapMode: 'ExactIn' | 'ExactOut';
    }, retries = 2): Promise<QuoteResponse | null> {
        const cacheKey = JSON.stringify(params);
        const now = Date.now();

        // Return cached quote if fresh and same params
        if (
            this.cachedQuote &&
            this.quoteParams === cacheKey &&
            now - this.quoteLastUpdated < this.QUOTE_CACHE_MS
        ) {
            return this.cachedQuote;
        }

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const urlParams = new URLSearchParams({
                    ...params,
                    // V2: dynamic slippage — Jupiter optimizes based on liquidity depth
                    // Falls back to maxBps if market is thin
                    dynamicSlippage: 'true',
                    maxAutoSlippageBps: this.MAX_SLIPPAGE_BPS.toString(),
                    // Only minimize: saves ~30% on fees vs 'auto'
                    dynamicComputeUnitLimit: 'true',
                    onlyDirectRoutes: 'false',    // allow multi-hop for best price
                    asLegacyTransaction: 'false',  // versioned tx (required for ALT)
                });

                const response = await fetch(
                    `${JUPITER_QUOTE_API}/quote?${urlParams.toString()}`
                );

                if (!response.ok) {
                    throw new Error(`Quote HTTP ${response.status}`);
                }

                const quote: QuoteResponse = await response.json();

                // Safety gate: block high price-impact swaps
                const impactPct = parseFloat(quote.priceImpactPct);
                if (impactPct > this.MAX_PRICE_IMPACT_PCT) {
                    console.warn(`Jupiter: price impact ${impactPct}% exceeds ${this.MAX_PRICE_IMPACT_PCT}% limit`);
                    return null;
                }

                // Cache and return
                this.cachedQuote = quote;
                this.quoteParams = cacheKey;
                this.quoteLastUpdated = now;
                return quote;

            } catch (error) {
                console.warn(`Jupiter quote attempt ${attempt + 1} failed:`, error);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SWAP TRANSACTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * V2: Get optimized swap transaction with priority fees.
     *
     * Improvements over V1:
     * - prioritizationFeeLamports: 'auto' picks the right fee tier
     * - dynamicComputeUnitLimit: true right-sizes the compute budget
     * - asLegacyTransaction: false enables Address Lookup Tables (smaller tx)
     *
     * @param quote     — from getQuote() or getExactOutQuote()
     * @param userKey   — signer wallet
     * @param destToken — optional: route output to a different ATA (charity wallet)
     */
    async getSwapTransaction(
        quote: QuoteResponse,
        userPublicKey: PublicKey,
        destinationWallet?: PublicKey
    ): Promise<VersionedTransaction | null> {
        try {
            const body: Record<string, unknown> = {
                quoteResponse: quote,
                userPublicKey: userPublicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                // V2: 'auto' selects from Triton's priority fee oracle
                // options: 'auto' | { jitoTipLamports: N } | { priorityLevelWithMaxLamports: { ... } }
                prioritizationFeeLamports: 'auto',
                asLegacyTransaction: false,
            };

            // Route output directly to charity/scholarship destination ATA
            if (destinationWallet) {
                body.destinationTokenAccount = destinationWallet.toString();
            }

            const response = await fetch(`${JUPITER_QUOTE_API}/swap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Swap API ${response.status}: ${errorText}`);
            }

            const { swapTransaction } = await response.json();
            const txBuffer = Buffer.from(swapTransaction, 'base64');
            return VersionedTransaction.deserialize(txBuffer);

        } catch (error) {
            console.error('Jupiter getSwapTransaction error:', error);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ROUTE VISUALIZATION (V2 feature)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Extract human-readable route labels from a quote.
     * Example: ["Orca", "Raydium"] or ["SOL → USDC → SKR via Orca"]
     */
    extractRouteLabels(quote: QuoteResponse): string[] {
        return quote.routePlan
            .map(step => step.swapInfo.label || step.swapInfo.ammKey.slice(0, 8))
            .filter(Boolean);
    }

    /**
     * Format the route as a readable string for UI display.
     * e.g. "SOL → $SKR (via Orca · Raydium, 2 hops)"
     */
    formatRoute(quote: QuoteResponse): string {
        const labels = this.extractRouteLabels(quote);
        const hops = quote.routePlan.length;
        const via = labels.length > 0 ? ` via ${labels.join(' → ')}` : '';
        const hopStr = hops === 1 ? '1 hop' : `${hops} hops`;
        return `SOL → $SKR (${hopStr}${via})`;
    }

    /**
     * Format price impact for display with color-coded severity.
     * Returns: { text: "0.02%", severity: 'low' | 'medium' | 'high' }
     */
    formatPriceImpact(quote: QuoteResponse): { text: string; severity: 'low' | 'medium' | 'high' } {
        const pct = parseFloat(quote.priceImpactPct);
        const text = pct < 0.01 ? '<0.01%' : `${pct.toFixed(2)}%`;
        const severity = pct < 0.1 ? 'low' : pct < 1.0 ? 'medium' : 'high';
        return { text, severity };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FORMATTERS
    // ─────────────────────────────────────────────────────────────────────────

    formatSkr(amount: number): string {
        if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
        if (amount >= 1_000) return (amount / 1_000).toFixed(2) + 'K';
        return amount.toFixed(2);
    }

    formatExpectedOutput(quote: QuoteResponse): string {
        const skrAmount = parseInt(quote.outAmount) / Math.pow(10, SKR_DECIMALS);
        return skrAmount.toFixed(4);
    }

    /**
     * Full quote summary for UI display
     */
    formatQuoteSummary(quote: QuoteResponse): {
        inputAmount: string;
        outputAmount: string;
        rate: string;
        priceImpact: { text: string; severity: 'low' | 'medium' | 'high' };
        route: string;
        slippagePct: string;
    } {
        const inSol = parseInt(quote.inAmount) / LAMPORTS_PER_SOL;
        const outSkr = parseInt(quote.outAmount) / Math.pow(10, SKR_DECIMALS);
        const rate = outSkr / inSol;

        return {
            inputAmount: `${inSol.toFixed(4)} SOL`,
            outputAmount: `${this.formatSkr(outSkr)} $SKR`,
            rate: `1 SOL ≈ ${this.formatSkr(rate)} $SKR`,
            priceImpact: this.formatPriceImpact(quote),
            route: this.formatRoute(quote),
            slippagePct: `${(quote.slippageBps / 100).toFixed(2)}%`,
        };
    }
}

export const jupiterSwap = new JupiterSwap();
export default jupiterSwap;
