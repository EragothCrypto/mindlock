/**
 * GoldRush (Covalent) API Client — Mindlock Charity Impact Dashboard
 *
 * Powers real-time charity wallet analytics:
 *   - Total $SKR received by the charity wallet
 *   - USD-valued transaction history (decoded SPL transfers)
 *   - Donation count and timestamps
 *   - Donor wallet history
 *
 * GoldRush eliminates the need for a custom indexer by returning structured,
 * decoded blockchain data across 100+ chains including Solana.
 *
 * Docs:  https://goldrush.dev/docs
 * Chain: solana-mainnet (charity wallet lives on mainnet)
 *
 * GoldRush Side Track — Colosseum Frontier Hackathon 2026
 */

// ============================================================================
// CONFIG
// ============================================================================

const GOLDRUSH_API = 'https://api.covalenthq.com/v1';
const GOLDRUSH_CHAIN = 'solana-mainnet';
const GOLDRUSH_DEVNET_CHAIN = 'solana-testnet'; // devnet fallback

/** Charity wallet — Mindlock's telagacharity.sol */
const CHARITY_WALLET = 'AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1';

/** $SKR token mint address */
const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

/** Cache TTL — 2 minutes (GoldRush rate limit is generous) */
const CACHE_TTL_MS = 2 * 60 * 1_000;

// ============================================================================
// TYPES
// ============================================================================

export interface DonationTransaction {
    txHash: string;
    fromAddress: string;
    skrAmount: number;
    usdValue: number;
    timestamp: string;
    blockHeight: number;
    explorerUrl: string;
}

export interface CharityImpactData {
    /** Total $SKR received by charity wallet (all time) */
    totalSkrReceived: number;
    /** Total USD value (GoldRush provides decoded pricing) */
    totalUsdRaised: number;
    /** Number of donation transactions */
    donationCount: number;
    /** Most recent 5 donations for the activity feed */
    recentDonations: DonationTransaction[];
    /** Current $SKR balance in the charity wallet */
    currentBalanceSkr: number;
    /** Whether data is live from API or from fallback */
    isLive: boolean;
    /** Fetched at timestamp */
    fetchedAt: number;
    /** GoldRush explorer link for the charity wallet */
    walletExplorerUrl: string;
}

interface GoldRushTransaction {
    tx_hash: string;
    block_signed_at: string;
    block_height: number;
    from_address: string;
    to_address: string;
    value_quote: number;
    transfers?: GoldRushTransfer[];
    log_events?: GoldRushLogEvent[];
}

interface GoldRushTransfer {
    transfer_type: 'IN' | 'OUT';
    from_address: string;
    to_address: string;
    contract_address: string;
    delta: string;
    delta_quote: number;
    contract_ticker_symbol: string;
}

interface GoldRushLogEvent {
    decoded?: {
        name: string;
        params?: { name: string; value: string }[];
    };
}

interface GoldRushBalance {
    contract_address: string;
    contract_ticker_symbol: string;
    balance: string;
    quote: number;
    contract_decimals: number;
}

// ============================================================================
// GOLDRUSH CLIENT
// ============================================================================

class GoldRushClient {
    private apiKey: string;
    private cache: CharityImpactData | null = null;
    private cacheTimestamp = 0;

    constructor(apiKey?: string) {
        // @ts-ignore — injected by react-native-dotenv
        this.apiKey = apiKey ?? process.env.GOLDRUSH_API_KEY ?? 'cqt_demo';
    }

    /**
     * Fetch complete charity impact data.
     * Returns cached data if < 2 minutes old.
     */
    async getCharityImpact(): Promise<CharityImpactData> {
        const now = Date.now();
        if (this.cache && now - this.cacheTimestamp < CACHE_TTL_MS) {
            return this.cache;
        }

        const [txData, balanceData] = await Promise.allSettled([
            this.fetchTransactionHistory(),
            this.fetchWalletBalance(),
        ]);

        const txResult = txData.status === 'fulfilled' ? txData.value : null;
        const balResult = balanceData.status === 'fulfilled' ? balanceData.value : null;

        const impact = this.buildImpactData(txResult, balResult);
        this.cache = impact;
        this.cacheTimestamp = now;
        return impact;
    }

    /**
     * GET /v1/{chain}/address/{wallet}/transactions_v3/
     * Returns decoded transaction history with USD pricing.
     */
    private async fetchTransactionHistory(): Promise<GoldRushTransaction[]> {
        // Try mainnet first, fall back to testnet for devnet wallets
        for (const chain of [GOLDRUSH_CHAIN, GOLDRUSH_DEVNET_CHAIN]) {
            try {
                const url = new URL(
                    `${GOLDRUSH_API}/${chain}/address/${CHARITY_WALLET}/transactions_v3/`
                );
                url.searchParams.set('key', this.apiKey);
                url.searchParams.set('page-size', '50');
                url.searchParams.set('no-logs', 'false');

                const res = await fetch(url.toString(), {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(8000),
                });

                if (!res.ok) continue;
                const json = await res.json();
                const items: GoldRushTransaction[] = json?.data?.items ?? [];

                if (items.length >= 0) return items; // even 0 is valid
            } catch {
                continue;
            }
        }
        throw new Error('GoldRush transaction history unavailable');
    }

    /**
     * GET /v1/{chain}/address/{wallet}/balances_v2/
     * Returns current token balances with USD pricing.
     */
    private async fetchWalletBalance(): Promise<GoldRushBalance[]> {
        for (const chain of [GOLDRUSH_CHAIN, GOLDRUSH_DEVNET_CHAIN]) {
            try {
                const url = new URL(
                    `${GOLDRUSH_API}/${chain}/address/${CHARITY_WALLET}/balances_v2/`
                );
                url.searchParams.set('key', this.apiKey);

                const res = await fetch(url.toString(), {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(8000),
                });

                if (!res.ok) continue;
                const json = await res.json();
                return json?.data?.items ?? [];
            } catch {
                continue;
            }
        }
        throw new Error('GoldRush balance unavailable');
    }

    /**
     * Process raw GoldRush data into structured CharityImpactData
     */
    private buildImpactData(
        txs: GoldRushTransaction[] | null,
        balances: GoldRushBalance[] | null
    ): CharityImpactData {
        // Extract incoming $SKR transfers
        const skrDonations: DonationTransaction[] = [];
        let totalSkr = 0;
        let totalUsd = 0;

        if (txs) {
            for (const tx of txs) {
                // Check transfers for incoming SKR
                const incomingSKR = tx.transfers?.find(
                    t =>
                        t.transfer_type === 'IN' &&
                        t.contract_address?.toLowerCase() === SKR_MINT.toLowerCase()
                );

                if (incomingSKR) {
                    const skrAmount = parseInt(incomingSKR.delta) / 1e9; // 9 decimals
                    const usdValue = incomingSKR.delta_quote ?? 0;

                    skrDonations.push({
                        txHash: tx.tx_hash,
                        fromAddress: tx.from_address,
                        skrAmount,
                        usdValue,
                        timestamp: tx.block_signed_at,
                        blockHeight: tx.block_height,
                        explorerUrl: `https://explorer.solana.com/tx/${tx.tx_hash}`,
                    });

                    totalSkr += skrAmount;
                    totalUsd += usdValue;
                }
            }
        }

        // Extract current $SKR balance
        const skrBalance = balances?.find(
            b => b.contract_address?.toLowerCase() === SKR_MINT.toLowerCase()
        );
        const currentBalanceSkr = skrBalance
            ? parseInt(skrBalance.balance) / Math.pow(10, skrBalance.contract_decimals ?? 9)
            : 0;

        return {
            totalSkrReceived: totalSkr,
            totalUsdRaised: totalUsd,
            donationCount: skrDonations.length,
            recentDonations: skrDonations.slice(0, 5),
            currentBalanceSkr,
            isLive: txs !== null || balances !== null,
            fetchedAt: Date.now(),
            walletExplorerUrl: `https://explorer.solana.com/address/${CHARITY_WALLET}`,
        };
    }

    /**
     * Format SKR amount for display
     */
    formatSkr(amount: number): string {
        if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
        if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
        return amount.toFixed(0);
    }

    /**
     * Format USD for display
     */
    formatUsd(amount: number): string {
        if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
        return `$${amount.toFixed(2)}`;
    }

    /**
     * Format a timestamp as relative time: "2 hours ago", "3 days ago"
     */
    formatRelativeTime(timestamp: string): string {
        try {
            const then = new Date(timestamp).getTime();
            const diffMs = Date.now() - then;
            const diffMins = Math.floor(diffMs / 60_000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${diffDays}d ago`;
        } catch {
            return '—';
        }
    }

    /**
     * Truncate wallet address for display: "FT5k...Wnses"
     */
    truncateAddress(address: string): string {
        if (address.length < 12) return address;
        return `${address.slice(0, 4)}...${address.slice(-5)}`;
    }
}

export const goldRush = new GoldRushClient();
export default goldRush;
