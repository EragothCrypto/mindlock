# Jupiter Integration — Developer Experience Report
## Mindlock × Jupiter Swap V2

**Submission:** Colosseum Hackathon 2026 — Jupiter Side Track  
**Project:** Mindlock — Proof-of-Brain Mobile App (Solana Seeker)  
**Integration file:** `Mindlock/src/solana/jupiterSwap.ts`

---

## Why Jupiter

Mindlock is a discipline app on Solana's Seeker device that locks social media unless the user completes a quiz. The core economic loop runs entirely through $SKR tokens:

```
Quiz Passed → Earn $SKR rewards
Lazy Unlock → Pay $1.50 in $SKR (charity donation)
Leaderboard → Top $SKR earners win scholarship pool
```

Every step requires accurate, real-time $SKR/USD pricing and reliable on-chain execution. Jupiter is the only routing layer that can provide this for a token like $SKR with sufficient liquidity depth — without building custom AMM integrations for every pool.

---

## Integration Architecture

### 1. Real-Time Dual Price Feed (`getPriceInfo`)

Mindlock fetches both $SKR and SOL prices from Jupiter's Price API v6 in a single request, with a 1-minute cache:

```typescript
// Single request — both prices in one round trip
const params = new URLSearchParams({
    ids: [SKR_TOKEN_MINT.toString(), SOL_MINT.toString()].join(','),
    vsToken: USDC_MINT.toString(),
});
const data = await fetch(`${JUPITER_PRICE_API}/price?${params}`);
```

**Why this matters:** The Lazy Unlock fee is always exactly $1.50 USD — not $1.50 in SOL, not a fixed SKR amount. Without Jupiter's price feed, we'd need a custom oracle or stale Pyth data. Jupiter gives us a live price anchored to real DEX liquidity at zero marginal cost.

---

### 2. ExactOut Quoting for Lazy Unlock (V2 Key Feature)

This is the most novel part of Mindlock's Jupiter integration. Standard swaps are **ExactIn**: "spend X SOL, get ~Y SKR". But for the Lazy Unlock charitable donation, we need to collect **exactly** $1.50 worth of $SKR — not approximately.

Jupiter V2's `swapMode: 'ExactOut'` solves this perfectly:

```typescript
// ExactOut: user pays however much SOL is needed to get EXACTLY the right SKR amount
async getExactOutQuote(skrAmountNeeded: number): Promise<QuoteResponse | null> {
    const skrLamports = Math.floor(skrAmountNeeded * Math.pow(10, SKR_DECIMALS));
    return this._fetchQuote({
        inputMint: SOL_MINT.toString(),
        outputMint: SKR_TOKEN_MINT.toString(),
        amount: skrLamports.toString(),
        swapMode: 'ExactOut',  // ← Jupiter V2 feature
    });
}
```

**What this enables:**  
A user wanting to do a Lazy Unlock sees: *"Pay 1,234 $SKR ($1.50 USD)"* — exact, no slippage uncertainty, no user confusion about whether they paid enough. This is critical for a product where the fee is a charity donation and precision = trust.

---

### 3. Dynamic Slippage (V2 Key Feature)

Instead of a hardcoded `slippageBps: 50`, Mindlock uses Jupiter's dynamic slippage engine:

```typescript
const urlParams = new URLSearchParams({
    dynamicSlippage: 'true',
    maxAutoSlippageBps: '300',  // 3% max cap
    dynamicComputeUnitLimit: 'true',
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'false',  // versioned tx → enables ALT compression
});
```

**What this enables:**  
- When $SKR liquidity is deep (low volatility): slippage auto-sets to ~20 bps → user saves money.
- When $SKR liquidity is thin (market stress): slippage caps at 300 bps → transaction still lands.
- Mindlock never reverts on-chain due to slippage, which would be catastrophic UX for an app that's blocking the user's phone.

---

### 4. Price Impact Safety Gate

Every quote is validated before showing to the user:

```typescript
const impactPct = parseFloat(quote.priceImpactPct);
if (impactPct > this.MAX_PRICE_IMPACT_PCT) {  // 2% threshold
    console.warn(`Jupiter: price impact ${impactPct}% exceeds limit`);
    return null;  // → UI shows "Market conditions unfavorable, try later"
}
```

This protects Mindlock users (often non-DeFi-native mobile users) from accidentally executing swaps that drain their wallet during thin liquidity events.

---

### 5. Route Visualization for UI

Jupiter's v6 `routePlan` array is parsed into human-readable routing labels:

```typescript
extractRouteLabels(quote: QuoteResponse): string[] {
    return quote.routePlan
        .map(step => step.swapInfo.label || step.swapInfo.ammKey.slice(0, 8))
        .filter(Boolean);
}

formatRoute(quote: QuoteResponse): string {
    // → "SOL → $SKR (2 hops via Orca → Raydium)"
}
```

This is displayed in the Lazy Unlock modal so users understand where their $SKR donation comes from — building trust with non-DeFi users.

---

### 6. Quote Caching + Retry Logic

```typescript
// 30-second quote cache — valid for one user interaction flow
// Prevents hammering the API between the "preview" and "confirm" taps
if (this.quoteParams === cacheKey && now - this.quoteLastUpdated < 30_000) {
    return this.cachedQuote;
}

// Exponential backoff retry for transient failures
for (let attempt = 0; attempt <= 2; attempt++) {
    // ...
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
}
```

Mobile networks are unreliable. A failed quote on someone's locked phone is a frustrating UX. The retry logic with cache means a single transient failure doesn't block the unlock flow.

---

## Token Flow Diagram

```
User Quiz Fail (Lazy Unlock)
         │
         ▼
Jupiter Price API v6
  $SKR/USD: $0.00123
         │
         ▼
ExactOut Quote ($1.50 / $0.00123 = 1,220 $SKR)
  Route: SOL → USDC → SKR (via Orca)
  Slippage: Dynamic (auto ~25 bps)
  Impact: 0.02% ✅
         │
         ▼
MWA (Seed Vault biometric sign)
         │
         ▼
Jupiter Swap Execution
  ┌──────┴──────┐
  ▼             ▼
40% Charity   60% Scholarship
(488 $SKR)    (732 $SKR)
telagacharity  Vault PDA
         │
         ▼
QuizPassed event → score_registry on-chain
Karma += donation amount
```

---

## DX Feedback for Jupiter Team

### What Worked Exceptionally Well

1. **`swapMode: 'ExactOut'`** — This solved a real UX problem. Most DeFi apps accept fee ambiguity; Mindlock couldn't. ExactOut is underused and deserves more documentation prominence.

2. **`dynamicSlippage`** — Removes a class of failed transactions that would be catastrophic on a device-lock app. Should be the default for mobile integrations.

3. **Price API v6 multi-token request** — Fetching SKR and SOL in a single call cuts latency in half vs two requests. Clean API design.

4. **`routePlan[].swapInfo.label`** — The DEX name label is excellent for building trust UI. Non-DeFi users feel safer seeing "Orca" than a raw address.

### What Could Be Improved

1. **ExactOut documentation** — The `swapMode` parameter is buried in the API reference. It deserves a top-level guide with mobile use cases.

2. **Price API WebSocket** — A push-based price feed would eliminate polling for price-sensitive UIs. The 1-minute cache is a workaround for the lack of subscriptions.

3. **Mobile SDK** — A React Native / Expo-compatible package would remove the need for manual Buffer polyfills on versioned transactions.

4. **Price impact in Price API** — The Quote API provides `priceImpactPct`, but the Price API doesn't. For display-only scenarios (no swap), having impact data would allow better UI warnings.

---

## Submission Summary

| Feature | Jupiter API Used | Unique to Mindlock |
|---|---|---|
| Real-time $SKR price | Price API v6 | Dynamic $1.50 fee |
| Lazy Unlock ExactOut | Quote API `swapMode: ExactOut` | Charity precision ✅ |
| Dynamic slippage | `dynamicSlippage: true` | Mobile-safe ✅ |
| Route visualization | `routePlan[].swapInfo.label` | Trust UI for non-DeFi ✅ |
| Price impact guard | `priceImpactPct` | User protection ✅ |
| Versioned tx + ALT | `asLegacyTransaction: false` | Smaller tx, lower fee ✅ |

**Mindlock is not a DeFi app that happens to have a quiz button. It is a discipline app where Jupiter is the economic infrastructure — every unlock decision flows through Jupiter pricing and execution.**
