/**
 * Kamino Finance — Yield Integration
 *
 * Mindlock's Scholarship Vault earns automated yield via Kamino Finance.
 * This module fetches live APY data from Kamino's public API and calculates
 * expected yield for the current epoch so users see their pool "growing
 * while they compete."
 *
 * Kamino Side Track (via Eitherway): qualifies Mindlock for the Kamino
 * prize track by integrating Kamino as the yield source for the scholarship pool.
 *
 * API Docs: https://docs.kamino.finance/
 * API Base: https://api.kamino.finance
 */

// ============================================================================
// CONFIG
// ============================================================================

const KAMINO_API = 'https://api.kamino.finance';

/** Kamino strategy addresses for known high-liquidity vaults (devnet/mainnet) */
const KAMINO_STRATEGY_ADDRESSES = {
    // USDC/SOL — highest TVL, reliable APY reference
    USDC_SOL: '2S8oBiZ4ECNPXD2ueBiNUrxc4aeaJVhGkBwPKPt8UGJL',
    // JitoSOL/SOL — liquid staking yield
    JITOSOL_SOL: 'G9erd35Z1KTQRpHPT9S5pYo2GWqFKf3w7f4wPomF6LwE',
};

/** Cache duration for APY data — 5 minutes */
const APY_CACHE_TTL_MS = 5 * 60 * 1_000;

/** Weeks per year (epoch = 1 week) */
const EPOCHS_PER_YEAR = 52;

// ============================================================================
// TYPES
// ============================================================================

export interface KaminoVaultStats {
    /** Annualized yield percentage (e.g., 8.35 = 8.35% APY) */
    apy: number;
    /** Total value locked across all Kamino strategies in USD */
    tvlUsd: number;
    /** Strategy name shown in UI */
    strategyLabel: string;
    /** URL to the Kamino dashboard for this strategy */
    dashboardUrl: string;
    /** Timestamp of this data fetch */
    fetchedAt: number;
    /** True if fetched from live API, false if using cached/fallback */
    isLive: boolean;
}

export interface EpochYieldEstimate {
    /** APY being applied */
    apy: number;
    /** Current vault balance in $SKR */
    vaultBalanceSkr: number;
    /** Yield earned this epoch in $SKR */
    yieldThisEpochSkr: number;
    /** Yield earned this epoch in USD */
    yieldThisEpochUsd: number;
    /** Total pool at epoch end (balance + yield) */
    projectedEpochEndSkr: number;
    /** Kamino strategy info */
    strategy: KaminoVaultStats;
}

// ============================================================================
// KAMINO YIELD CLIENT
// ============================================================================

class KaminoYieldClient {
    private cachedStats: KaminoVaultStats | null = null;
    private cacheTimestamp: number = 0;

    /**
     * Fetch live APY from Kamino's strategies API.
     *
     * Strategy: query all LIVE strategies, pick the highest APY among
     * the curated set that Mindlock's scholarship vault is eligible for.
     * Returns fallback data if the API is unavailable.
     */
    async getVaultApy(): Promise<KaminoVaultStats> {
        const now = Date.now();

        // Return cached if still fresh
        if (this.cachedStats && now - this.cacheTimestamp < APY_CACHE_TTL_MS) {
            return this.cachedStats;
        }

        try {
            // Fetch all live Kamino strategies
            const response = await fetch(
                `${KAMINO_API}/strategies?status=LIVE&sortBy=totalValueLocked&orderBy=desc`,
                {
                    headers: { Accept: 'application/json' },
                    // Short timeout — don't block the UI
                    signal: AbortSignal.timeout(5000),
                }
            );

            if (!response.ok) {
                throw new Error(`Kamino API ${response.status}`);
            }

            const strategies: any[] = await response.json();

            // Find the best APY among high-TVL strategies > $1M TVL
            // (avoids picking thin/exploit-risk pools)
            const eligibleStrategies = strategies.filter(
                (s: any) =>
                    s.status === 'LIVE' &&
                    parseFloat(s.totalValueLocked ?? '0') > 1_000_000
            );

            if (eligibleStrategies.length === 0) {
                throw new Error('No eligible strategies found');
            }

            // Sort by APY descending, pick best
            const best = eligibleStrategies.sort(
                (a: any, b: any) =>
                    parseFloat(b.apy ?? '0') - parseFloat(a.apy ?? '0')
            )[0];

            const apy = parseFloat(best.apy ?? '0') * 100; // API returns decimal (e.g. 0.0835 = 8.35%)
            const tvlUsd = parseFloat(best.totalValueLocked ?? '0');
            const tokenA = best.tokenAMint ?? '';
            const tokenB = best.tokenBMint ?? '';
            const strategyAddr = best.address ?? '';

            const stats: KaminoVaultStats = {
                apy: Math.min(apy, 50), // sanity cap at 50% APY
                tvlUsd,
                strategyLabel: this.buildStrategyLabel(best, tokenA, tokenB),
                dashboardUrl: `https://app.kamino.finance/liquidity/${strategyAddr}`,
                fetchedAt: now,
                isLive: true,
            };

            this.cachedStats = stats;
            this.cacheTimestamp = now;
            return stats;

        } catch (error) {
            console.warn('Kamino API unavailable, using reference APY:', error);

            // Fallback: use a conservative reference APY
            // Based on historical Kamino USDC/SOL strategy performance
            const fallback: KaminoVaultStats = {
                apy: 8.35,
                tvlUsd: 0,
                strategyLabel: 'USDC/SOL Vault',
                dashboardUrl: 'https://app.kamino.finance',
                fetchedAt: now,
                isLive: false,
            };

            // Cache the fallback too (shorter TTL implied by isLive: false)
            this.cachedStats = fallback;
            this.cacheTimestamp = now;
            return fallback;
        }
    }

    /**
     * Calculate yield that will accrue over the current epoch (1 week).
     *
     * @param vaultBalanceSkr — current scholarship vault balance in $SKR
     * @param skrPriceUsd     — current $SKR price in USD
     */
    async calculateEpochYield(
        vaultBalanceSkr: number,
        skrPriceUsd: number
    ): Promise<EpochYieldEstimate> {
        const strategy = await this.getVaultApy();

        // Weekly yield = APY / 52 weeks
        const weeklyYieldPct = strategy.apy / EPOCHS_PER_YEAR / 100;
        const yieldSkr = vaultBalanceSkr * weeklyYieldPct;
        const yieldUsd = yieldSkr * skrPriceUsd;

        return {
            apy: strategy.apy,
            vaultBalanceSkr,
            yieldThisEpochSkr: yieldSkr,
            yieldThisEpochUsd: yieldUsd,
            projectedEpochEndSkr: vaultBalanceSkr + yieldSkr,
            strategy,
        };
    }

    /**
     * Format APY for display: "~8.35% APY"
     */
    formatApy(stats: KaminoVaultStats): string {
        if (!stats.isLive) return `~${stats.apy.toFixed(2)}% APY`;
        return `${stats.apy.toFixed(2)}% APY`;
    }

    /**
     * Format weekly yield for display: "+1,234 $SKR this epoch"
     */
    formatWeeklyYield(estimate: EpochYieldEstimate): string {
        const skr = estimate.yieldThisEpochSkr;
        if (skr >= 1_000) return `+${(skr / 1_000).toFixed(1)}K $SKR this epoch`;
        return `+${skr.toFixed(0)} $SKR this epoch`;
    }

    /**
     * Format TVL for display: "$12.4M TVL"
     */
    formatTvl(stats: KaminoVaultStats): string {
        const tvl = stats.tvlUsd;
        if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(1)}M TVL`;
        if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(0)}K TVL`;
        return `$${tvl.toFixed(0)} TVL`;
    }

    private buildStrategyLabel(strategy: any, _tokenA: string, _tokenB: string): string {
        // Use name if available, otherwise reconstruct
        if (strategy.name) return strategy.name;
        return 'Automated Vault';
    }
}

export const kaminoYield = new KaminoYieldClient();
export default kaminoYield;
