# 🎬 Mindlock — Demo \u0026 Setup Guide

> For **judges, reviewers, and developers** who want to build, run, or verify Mindlock on a Solana Seeker device.

---

## Option A: Pre-Built APK (Fastest — 2 minutes)

The repo includes a working release APK:

```
Mindlock-Release.apk (57 MB)
```

### Steps

1. **Transfer** `Mindlock-Release.apk` to your Seeker via USB or ADB:
   ```bash
   adb install Mindlock-Release.apk
   ```
2. **Open Mindlock** — you'll see the neon-noir onboarding screen.
3. **Tap "Connect Wallet"** — this triggers Seed Vault biometric authentication via MWA.
4. **Complete the 5-step setup:**
   - Step 1: Connect wallet (MWA + Seed Vault)
   - Step 2: Select apps to block (TikTok, Instagram, X, etc.)
   - Step 3: Grant permissions (Usage Access + Display Over Other Apps)
   - Step 4: Review charity \u0026 karma info
   - Step 5: Activate the Warden
5. **Open a blocked app** (e.g., TikTok) — the quiz overlay appears.
6. **Answer 3 questions** — all correct grants a 60-minute grace period.
7. **Get one wrong** — glitch screen + "HERE'S WHY" explanation card.
8. **Dashboard** — view live stats, karma tier, leaderboard, and charity impact.

---

## Option B: Build from Source

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | LTS recommended |
| JDK | 17 | Android builds |
| Android SDK | 34+ | via Android Studio |
| Solana CLI | 3.0+ | Only for on-chain scripts (optional) |
| Anchor | 0.30+ | Only for program builds (optional) |
| Seeker Device | — | Required for Seed Vault / MWA |

### 1. Clone \u0026 Environment

```bash
git clone https://github.com/mindlock-app/mindlock.git
cd mindlock

# Copy environment template
cp .env.example Mindlock/.env
```

Edit `Mindlock/.env` with your keys:
```env
# Required for Quicknode side track (optional — falls back to public RPC)
QUICKNODE_DEVNET_URL=https://your-endpoint.solana-devnet.quiknode.pro/abc123/

# Required for GoldRush impact dashboard (optional — dashboard shows placeholder)
GOLDRUSH_API_KEY=cqt_your_key_here

# These are pre-configured for devnet:
COMMITMENT_VAULT_PROGRAM_ID=5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC
SCORE_REGISTRY_PROGRAM_ID=A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx
```

> **Note:** Mindlock works without Quicknode or GoldRush keys. Both integrations fall back gracefully.

### 2. Install \u0026 Build

```bash
cd Mindlock
npm install

# Connect Seeker via USB, then:
npx react-native run-android --mode=release
```

### 3. Seed Leaderboard (Optional)

If you want to see the leaderboard populated with demo data:

```bash
cd ..  # back to repo root
npm install  # install anchor/web3 deps
npm run seed
```

This creates 10 seeded players on devnet (ProofOfBram → NewComer) with varying Focus Scores.

---

## Verifying On-Chain Programs

All programs are live on **Solana Devnet**:

### Commitment Vault
```
Program: 5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC
Explorer: https://explorer.solana.com/address/5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC?cluster=devnet
```
- 7-day SOL commitment lock
- Daily check-in PDA tracking
- Fully upgradeable (authority: `FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses`)

### Score Registry
```
Program: A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx
Explorer: https://explorer.solana.com/address/A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx?cluster=devnet
```
- Quiz attestation: `QuizPassed` event with SHA-256 question hash
- Leaderboard: `UserScore` PDAs with Focus Score formula
- Global stats: `GlobalStats` PDA tracking total quizzes, epoch info

### Charity Wallet
```
Address: AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1  (telagacharity.sol)
Explorer: https://explorer.solana.com/address/AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1?cluster=devnet
```
- Receives 40% of all Lazy Unlock fees
- Receives 50% of all Day Pass fees
- Tracked in real-time by the GoldRush Impact Dashboard

---

## Key User Flows

### Flow 1: Knowledge Gate (Core Loop)
```
User opens blocked app
  → WardenService intercepts via UsageStatsManager
  → KnowledgeGate overlay appears with 3 quiz questions
  → User answers ALL correctly → Seed Vault signature → 60-min grace period
  → OR wrong answer → GlitchScreen + explanation → quiz resets
```

### Flow 2: Lazy Unlock (Charity Donation)
```
User taps "Lazy Unlock" on quiz screen
  → Jupiter ExactOut swap: SOL → $SKR (exactly $1.50 worth)
  → $SKR redistributed: 40% charity + 60% scholarship
  → Transaction submitted as Jito Bundle (MEV-protected, atomic)
  → Karma score updated (+50 points, tier check)
  → 60-min unlock granted
```

### Flow 3: Day Pass (Emergency Break)
```
User taps "Day Pass" on dashboard
  → Confirms 500 $SKR payment ($5.00)
  → 50/50 split: charity + scholarship
  → Transaction submitted as Jito Bundle (atomic charity + scholarship)
  → 24-hour shield mode activated (NTP-verified)
  → Streak frozen (not broken) during shield
  → 7-day cooldown enforced
```

### Flow 4: Leaderboard \u0026 Scholarship
```
User completes quizzes throughout the week
  → Focus Score = Σ(accuracy × difficulty × focusMinutes)
  → Ranked against all players on-chain
  → At epoch end: top 3 claim from scholarship pool
  → Seed Vault biometric confirms claim
```

---

## Side Track Verification

| Track | Key Evidence |
|---|---|
| **Jupiter** | `src/solana/jupiterSwap.ts` — ExactOut V2 swap. See [JUPITER_DX_REPORT.md](../JUPITER_DX_REPORT.md) |
| **Jito** | `src/solana/jitoBundle.ts` — MEV-protected bundle submission. See [JITO_DX_REPORT.md](../JITO_DX_REPORT.md) |
| **Kamino** | `src/solana/kaminoYield.ts` — Live APY fetch + epoch yield. See [KAMINO_DX_REPORT.md](../KAMINO_DX_REPORT.md) |
| **Quicknode** | `src/config/network.ts` — Env-var RPC routing. See [QUICKNODE_DX_REPORT.md](../QUICKNODE_DX_REPORT.md) |
| **GoldRush** | `src/solana/goldRushClient.ts` + `src/components/ImpactCard.tsx`. See [GOLDRUSH_DX_REPORT.md](../GOLDRUSH_DX_REPORT.md) |

---

## Troubleshooting

| Issue | Solution |
|---|---|
| **"Wallet Connection Failed"** | Ensure Seed Vault is set up on your Seeker. Open Settings → Seed Vault. |
| **Quiz doesn't appear** | Grant both **Usage Access** and **Display Over Other Apps** permissions. |
| **Leaderboard empty** | Run `npm run seed` from the repo root to populate with demo data. |
| **RPC errors** | Add a Quicknode URL to `.env` or ensure devnet is reachable. |
| **GoldRush dashboard empty** | Add `GOLDRUSH_API_KEY` to `.env`. Falls back to "No data" gracefully. |

---

## Questions?

Open an issue on this repo or reach out on [X / Twitter](https://twitter.com/MindlockApp).
