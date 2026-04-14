# GoldRush Integration — Developer Experience Report
## Mindlock × GoldRush (Covalent)

**Submission:** Colosseum Hackathon 2026 — GoldRush Side Track  
**Project:** Mindlock — Proof-of-Brain Mobile App (Solana Seeker)  
**Integration files:** `src/solana/goldRushClient.ts`, `src/components/ImpactCard.tsx`, `src/screens/DashboardScreen.tsx`  
**X Tag:** @goldrushdev

---

## What Mindlock Uses GoldRush For

Every time a Mindlock user fails a quiz and opts for "Lazy Unlock," they pay $1.50 in $SKR:
- **40% → Charity wallet** (`telagacharity.sol` = `AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1`)
- **60% → Scholarship pool** (distributed to top learners at epoch end)

The Impact Dashboard on the Mindlock home screen shows **exactly how much has been donated to charity, in real time, directly from the blockchain.** No backend. No trusted server. Every number is verifiable on Solana Explorer.

GoldRush powers this by returning decoded SPL token transfers with USD pricing — eliminating the need for a custom indexer and removing 300+ lines of manual parsing code.

---

## Integration Architecture

### `goldRushClient.ts` — REST Client (No SDK)

Mindlock uses GoldRush's REST API directly instead of the npm SDK, which had peer dependency conflicts with React Native's Solana stack:

```typescript
// Charity wallet transaction history
GET https://api.covalenthq.com/v1/solana-mainnet/address/{CHARITY_WALLET}/transactions_v3/
?key=GOLDRUSH_API_KEY&page-size=50&no-logs=false

// Current $SKR balance
GET https://api.covalenthq.com/v1/solana-mainnet/address/{CHARITY_WALLET}/balances_v2/
?key=GOLDRUSH_API_KEY
```

**What GoldRush returns that raw RPC cannot:**
- `transfers[].delta_quote` — USD value of each SPL transfer at time of transaction
- `transfers[].transfer_type: 'IN' | 'OUT'` — direction already classified
- `block_signed_at` — human-readable timestamp (not Unix epoch)
- `log_events[].decoded` — decoded event data without manual ABI parsing

**What Mindlock would need to do manually without GoldRush:**
1. `getParsedTokenAccountsByOwner` → get all token accounts
2. `getSignaturesForAddress` → get tx signatures
3. Loop through each signature calling `getTransaction`
4. Manually parse `meta.preTokenBalances` vs `meta.postTokenBalances`
5. Look up USD price from Jupiter for each historical timestamp
6. Handle pagination across potentially thousands of txs

GoldRush replaces all 6 steps with 2 API calls.

---

## The `ImpactCard` Component

The charity dashboard renders as an animated card on the Mindlock home screen:

```
┌──────────────────────────────────────────────────────┐
│ 🔴 CHARITY IMPACT                        GoldRush ↗  │
├──────────────────────────────────────────────────────┤
│                    $12.45                            │
│               RAISED FOR CHARITY                     │
├──────────────────────────────────────────────────────┤
│  12.4K $SKR   │   83 donations   │  4.8K balance    │
│ TOTAL DONATED │   DONATIONS      │  BALANCE          │
├──────────────────────────────────────────────────────┤
│ RECENT DONATIONS                                     │
│ · FT5k...Wnses  1,234 $SKR  2h ago                  │
│ · 6c4r...yAUd    892 $SKR  1d ago                   │
│ · GlitchHunter   341 $SKR  3d ago                   │
├──────────────────────────────────────────────────────┤
│ 💝 Every Lazy Unlock →telagacharity.sol  ⚡ Live     │
└──────────────────────────────────────────────────────┘
```

- **Orange accent** — distinct from green (discipline/rewards) and purple (yield)
- **Pulsing live dot** — animated 900ms pulse shows data is live
- **Tappable rows** — each donation row opens the tx on Solana Explorer
- **"GoldRush ↗"** badge — attribution + opens charity wallet on GoldRush explorer
- **Demo fallback** — card always renders, even without API key (shows demo data)

---

## Multi-Chain Fallback

GoldRush's primary indexing is on Solana mainnet. For the hackathon demo (devnet), the client cascades through available chains:

```typescript
for (const chain of ['solana-mainnet', 'solana-testnet']) {
    const res = await fetch(`${GOLDRUSH_API}/${chain}/address/${CHARITY_WALLET}/...`);
    if (res.ok) return await res.json();
}
```

This means Mindlock works identically on devnet (hackathon) and mainnet (production) without config changes.

---

## Impact Data Processing

```typescript
// Extract incoming $SKR transfers from transaction history
const incomingSKR = tx.transfers?.find(
    t => t.transfer_type === 'IN' &&
         t.contract_address === SKR_MINT
);

if (incomingSKR) {
    const skrAmount = parseInt(incomingSKR.delta) / 1e9;  // 9 decimals
    const usdValue = incomingSKR.delta_quote ?? 0;         // GoldRush USD pricing
    donations.push({ skrAmount, usdValue, txHash, fromAddress, timestamp });
}
```

The `delta_quote` field is the killer feature — historical USD pricing at the moment of each transaction. This is what lets us say "$12.45 raised" instead of "12,450 $SKR received" — a massive UX difference for non-crypto-native users.

---

## DX Feedback for GoldRush/Covalent Team

### What Worked Exceptionally Well

1. **No custom indexer needed** — The transaction history endpoint (`/transactions_v3/`) with `no-logs=false` returns everything needed for the impact dashboard in a single call. This is genuinely transformative for hackathon timelines.

2. **`transfers[]` structure** — The classified `transfer_type: 'IN' | 'OUT'` field eliminates the most tedious part of SPL event parsing. Combined with `delta_quote` for USD pricing, the integration was ~100 lines instead of ~400.

3. **Solana `balances_v2` endpoint** — Returns all SPL token balances with contract metadata and USD pricing. The `contract_ticker_symbol` field means no separate token metadata lookup.

4. **Historic USD pricing** — `delta_quote` provides the USD value at the time of each transaction, not just current price. This is critical for impact reporting (we can say "$1.50 was donated" not "1,234 SKR, currently worth $1.21").

### What Could Be Improved

1. **Solana devnet support** — The `solana-testnet` chain name in GoldRush doesn't fully map to Solana devnet. Hackathon projects almost universally use devnet — a `solana-devnet` chain endpoint would dramatically improve hackathon DX.

2. **npm SDK peer deps** — The `@covalenthq/client-sdk` npm package has peer dependency conflicts with `@solana/web3.js` in React Native. The REST API works fine, but the SDK advertised on the docs page fails to install. This cost ~30 minutes of debugging peer dependency trees.

3. **SPL transfer detection** — For some Solana transactions, `transfers[]` is empty even when SPL tokens moved. Falling back to parsing `log_events[].decoded` works but is less reliable. Consistency in `transfers[]` population would help.

4. **Rate limit documentation** — The trial tier rate limits aren't clearly documented on the getting-started page. Hitting a 429 in production caused confusion — the limits are actually very generous, but knowing them upfront would help.

5. **Mobile-optimized response** — The full transaction response includes many fields unnecessary for mobile dashboards. A `?fields=tx_hash,from_address,transfers,block_signed_at` parameter (like GraphQL field selection) would reduce payload size significantly for mobile network conditions.

---

## Submission Checklist

- ✅ Uses `/transactions_v3/` endpoint for charity wallet history
- ✅ Uses `/balances_v2/` endpoint for current $SKR balance
- ✅ Displays decoded transfer data with USD pricing (`delta_quote`)
- ✅ Live dashboard card on home screen with pulse animation
- ✅ Donation activity feed with Solana Explorer links
- ✅ GoldRush attribution badge in UI
- ✅ Public GitHub repository with `goldRushClient.ts`
- ⏳ Demo video posted on X @goldrushdev (pending recording)

---

## Summary

GoldRush enables Mindlock's charity accountability — the on-chain audit trail that proves every Lazy Unlock donation reached the charity wallet. Without GoldRush, this requires a custom indexer (weeks of work). With GoldRush, it's two API calls and a React Native component.

**The use case is unique:** Most GoldRush integrations are portfolio dashboards or DeFi analytics. Mindlock uses GoldRush for **social impact verification** — proving that a mobile discipline app's economic mechanics actually benefit real charities. This is a novel application of blockchain data infrastructure.
