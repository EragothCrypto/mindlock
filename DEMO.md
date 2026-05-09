# 🎬 Mindlock — Judge Demo Guide

> **For Colosseum Frontier judges with a Solana Seeker device.**
> Estimated setup time: **5–10 minutes.**

---

## What You Need

| Requirement | Notes |
|---|---|
| Solana Seeker device | With Seed Vault configured (wallet already set up) |
| Devnet SOL | ~0.1 SOL for transaction fees — [get free airdrop below](#1-fund-your-wallet) |
| Devnet $SKR | For Lazy Unlock / Day Pass demos — [instructions below](#optional-get-skr-for-payment-demos) |

---

## Step 1 — Install the APK

### Option A: Direct Download (Easiest)

1. Go to: **https://github.com/EragothCrypto/mindlock/blob/main/Mindlock-Release.apk**
2. Tap **"View raw"** → the APK downloads to your Seeker
3. Open the downloaded file → tap **Install**
4. If prompted, allow "Install from unknown sources" for your browser

### Option B: ADB (From a computer)

```bash
# Clone the repo
git clone https://github.com/EragothCrypto/mindlock.git
cd mindlock

# Install directly to connected Seeker
adb install Mindlock-Release.apk
```

---

## Step 2 — Fund Your Wallet

The app runs on **Solana Devnet** — all transactions are free test transactions, no real money.

**Get devnet SOL (required for tx fees):**

```bash
# Option A: Web faucet (easiest)
# Go to: https://faucet.solana.com
# Paste your Seeker wallet address → request 2 SOL

# Option B: CLI
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

> Your Seeker wallet address is visible in **Seed Vault → Settings → View Address**.

---

## Step 3 — Launch & Connect Wallet

1. Open **Mindlock** on your Seeker
2. Tap **"Connect Wallet"** — this triggers Seed Vault biometric authentication (fingerprint)
3. Approve the MWA connection in the Seed Vault prompt
4. You're connected — your wallet address appears in the top-right corner

---

## Step 4 — Grant Android Permissions

Mindlock needs two Android permissions to intercept apps at the OS level:

### Permission 1: Usage Access
1. Tap **"Grant Usage Access"** in the onboarding flow
2. Android Settings opens automatically — find **Mindlock** in the list
3. Toggle **ON** → "Permit usage access"
4. Press back to return to Mindlock

### Permission 2: Display Over Other Apps
1. Tap **"Grant Overlay Permission"**
2. Android Settings opens — find **Mindlock**
3. Toggle **ON** → "Allow display over other apps"
4. Press back to return to Mindlock

> ⚠️ Both permissions are required for the quiz overlay to appear. If the quiz doesn't show, check both are granted in **Settings → Apps → Mindlock → Permissions**.

---

## Step 5 — Select Apps to Block

1. Tap **"Choose Apps to Block"**
2. Select 1–3 apps from the list (e.g. TikTok, Instagram, X)
3. Tap **"Activate Warden"**

The Warden is now running as an Android foreground service. A persistent notification confirms it's active.

---

## Step 6 — Trigger the Quiz

Open one of your blocked apps (e.g. TikTok).

Within 1–2 seconds, the **Mindlock quiz overlay** appears on top of TikTok:
- 3 questions: 2 Easy/Medium + 1 Hard (marked 💀)
- Answer all 3 correctly → **60-minute grace period** granted, Seed Vault signs the attestation
- Get one wrong → **GlitchScreen** animation + **"HERE'S WHY"** explanation card

---

## Key Flows to Test

### ✅ Perfect Score (Core Loop)
Answer all 3 correctly. Watch the Seed Vault biometric prompt appear → quiz passes → grace timer starts on the Dashboard.

### ✅ Wrong Answer → Learning Moment
Deliberately answer one incorrectly. The glitch animation plays, then a card shows the correct answer and explanation.

### ✅ Dashboard
Open Mindlock directly. Shows:
- Live grace timer / streak
- Karma tier badge
- GoldRush Impact Dashboard (charity donations feed)
- Leaderboard preview

### ✅ Leaderboard
Tap **Leaderboard** → see 10 seeded players ranked by Focus Score (ProofOfBram → NewComer). Your wallet appears after your first quiz pass.

---

## Optional: Get $SKR for Payment Demos

To test **Lazy Unlock** ($1.50 → charity) and **Day Pass** ($7.50 → shield), you need devnet $SKR tokens.

```bash
# $SKR mint on devnet
SKR_MINT=SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3

# Airdrop $SKR to your wallet (requires spl-token CLI)
spl-token mint $SKR_MINT 1000 YOUR_WALLET_ADDRESS --url devnet
```

> **Alternatively:** Tap **"Lazy Unlock"** on the quiz screen without $SKR — the app shows the price quote and Jupiter swap route even if the tx isn't sent (good for judging the UI flow).

---

## Verify On-Chain Programs

All programs are live on **Solana Devnet**:

| Program | Address | Explorer |
|---|---|---|
| **Commitment Vault** | `5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC` | [View ↗](https://explorer.solana.com/address/5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC?cluster=devnet) |
| **Score Registry** | `A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx` | [View ↗](https://explorer.solana.com/address/A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx?cluster=devnet) |
| **Charity Wallet** | `AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1` | [View ↗](https://explorer.solana.com/address/AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1?cluster=devnet) |

After answering a quiz correctly, search your wallet address on Explorer — you'll see a `QuizPassed` event emitted by the `score_registry` program (SHA-256 question set hash included).

---

## Side Track Verification

| Track | File | DX Report |
|---|---|---|
| **Jupiter** | `Mindlock/src/solana/jupiterSwap.ts` | [JUPITER_DX_REPORT.md](JUPITER_DX_REPORT.md) |
| **Jito** | `Mindlock/src/solana/jitoBundle.ts` | [JITO_DX_REPORT.md](JITO_DX_REPORT.md) |
| **Kamino** | `Mindlock/src/solana/kaminoYield.ts` | [KAMINO_DX_REPORT.md](KAMINO_DX_REPORT.md) |
| **Quicknode** | `Mindlock/src/config/network.ts` | [QUICKNODE_DX_REPORT.md](QUICKNODE_DX_REPORT.md) |
| **GoldRush** | `Mindlock/src/solana/goldRushClient.ts` | [GOLDRUSH_DX_REPORT.md](GOLDRUSH_DX_REPORT.md) |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Quiz overlay doesn't appear | Check both permissions granted: **Settings → Apps → Mindlock → Permissions** |
| "Wallet Connection Failed" | Ensure Seed Vault is set up: **Settings → Seed Vault → View Wallet** |
| Leaderboard empty | Run `npm run seed` from repo root (requires Node + devnet SOL) |
| Transaction fails (RPC error) | Public devnet RPC can be slow. Retry — or add Quicknode URL to `.env` |
| GoldRush dashboard shows no data | Expected without API key. Add `GOLDRUSH_API_KEY` to `Mindlock/.env` |

---

## Questions?

Open an issue on [GitHub](https://github.com/EragothCrypto/mindlock/issues) or reach out on X: [@MindlockApp](https://twitter.com/MindlockApp)
