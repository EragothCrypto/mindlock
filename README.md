<p align="center">
  <h1 align="center">🔒 MINDLOCK</h1>
  <p align="center"><strong>The world's first OS-level, blockchain-gated productivity app.</strong></p>
  <p align="center">Built for <a href="https://solanamobile.com/seeker">Solana Seeker</a> · Powered by Seed Vault + MWA</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solana-Devnet-blue?logo=solana" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/Platform-Android_(Seeker)-green?logo=android" alt="Android" />
  <img src="https://img.shields.io/badge/Framework-React_Native-purple?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Anchor-0.30.1-orange" alt="Anchor" />
  <img src="https://img.shields.io/badge/Hackathon-Colosseum_Frontier_2026-gold" alt="Colosseum" />
</p>

---

> *"Mindlock turns your phone addiction into Solana knowledge — and your failure into charity."*

## The Problem

The average person loses **4–7 hours/day** to brain-rot apps. Every existing screen-time app is bypassed in under 60 seconds.

## The Solution

Mindlock intercepts blocked apps at the **Android OS level** and demands proof of knowledge — **3 Solana quiz questions** — before granting access. All failure payments go on-chain: **40% to verified charities, 60% to a weekly scholarship pool** for top learners. Your Seeker's Seed Vault is the key — biometric-signed, non-spoofable, non-exportable.

---

## ⚡ Live on Devnet

| Program | Address | Explorer |
|---|---|---|
| **Commitment Vault** | `5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC` | [View ↗](https://explorer.solana.com/address/5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC?cluster=devnet) |
| **Score Registry** | `A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx` | [View ↗](https://explorer.solana.com/address/A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx?cluster=devnet) |
| **Charity Wallet** | `AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1` (telagacharity.sol) | [View ↗](https://explorer.solana.com/address/AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1?cluster=devnet) |
| **Upgrade Authority** | `FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses` | [View ↗](https://explorer.solana.com/address/FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses?cluster=devnet) |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      MINDLOCK APP                            │
│  React Native (TypeScript)  ·  Kotlin (Android Native)       │
├──────────────┬───────────────┬───────────────┬───────────────┤
│  KnowledgeGate │  WardenService  │  DashboardScreen │  LeaderboardScreen │
│  (Quiz + MWA)  │  (OS Intercept) │  (Stats + Karma) │  (On-chain Ranks)  │
└──────┬─────────┴───────┬────────┴───────┬───────────┴───────┘
       │                 │                │
       ▼                 ▼                ▼
┌──────────────────────────────────────────────────────────────┐
│                    SOLANA INTEGRATION LAYER                   │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Jupiter  │  Kamino  │ GoldRush │ Quicknode│  Jito    │ Seed Vault │
│ Swap V2  │  Yield   │ Impact   │  RPC     │  Bundles │ MWA Sign   │
│ ExactOut │  APY     │ Dashboard│  Routing │  MEV     │ Biometric  │
└──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    SOLANA DEVNET                              │
├────────────────────────┬─────────────────────────────────────┤
│   commitment_vault     │   score_registry                    │
│   (7-day stake lock)   │   (quiz attestation + leaderboard)  │
│   5capkwaV1E7s3j2Z...  │   A2n66MaKH2KhcJJnnBfh56V...       │
├────────────────────────┴─────────────────────────────────────┤
│           telagacharity.sol (charity wallet)                  │
│           AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Features

### OS-Level App Interception
- `WardenService` (Kotlin foreground service) monitors `UsageStatsManager` every 500ms
- Blocks TikTok, Instagram, X, Reddit, YouTube at the Android activity level
- Cannot be bypassed by clearing data, force-stopping, or changing system clock (NTP-verified)

### Knowledge Gate
- 3 questions per quiz: 2 Easy/Medium + 1 Hard (guaranteed)
- Quiz content hash (SHA-256) is attested **on-chain** via `QuizPassed` event
- Wrong answers show an animated glitch screen with **"HERE'S WHY"** learning explanations
- Questions fetched from a remote oracle (GitHub Gist) with **hash verification** against tampering

### Proof-of-Brain On-Chain
- Every perfect quiz pass calls `submitScore` on the `score_registry` program
- On-chain: `QuizPassed { wallet, question_set_hash, timestamp, difficulty }`
- Verifiable on Solana Explorer → immutable proof the user actually studied

### Economics
| Event | $SKR Flow |
|---|---|
| **Lazy Unlock** ($1.50) | 40% → Charity · 60% → Scholarship Pool |
| **Day Pass** ($5.00) | 50% → Charity · 50% → Scholarship Pool |
| **Epoch End** (weekly) | Top learners claim from Scholarship Pool |

### DeFi Integrations

| Integration | Purpose | DX Report |
|---|---|---|
| **Jupiter Swap V2** | ExactOut $1.50 charity fee with dynamic slippage | [JUPITER_DX_REPORT.md](JUPITER_DX_REPORT.md) |
| **Jito Bundles** | MEV-protected atomic bundle submission for all payments | [JITO_DX_REPORT.md](JITO_DX_REPORT.md) |
| **Kamino Finance** | Scholarship pool earns yield while users compete | [KAMINO_DX_REPORT.md](KAMINO_DX_REPORT.md) |
| **Quicknode RPC** | Env-var routing, <40ms leaderboard fetches | [QUICKNODE_DX_REPORT.md](QUICKNODE_DX_REPORT.md) |
| **GoldRush (Covalent)** | Live charity impact dashboard with USD pricing | [GOLDRUSH_DX_REPORT.md](GOLDRUSH_DX_REPORT.md) |

---

## 📂 Project Structure

```
Mindlock/
├── programs/
│   ├── commitment_vault/      # Anchor program — 7-day SOL stake lock
│   └── score_registry/        # Anchor program — leaderboard + quiz attestation
├── scripts/
│   └── seedLeaderboard.ts     # Seeds 10 demo players for judging
├── Mindlock/                  # React Native app (Android)
│   ├── android/               # Kotlin native modules (WardenService, DayPass, Quiz)
│   └── src/
│       ├── components/        # KnowledgeGate, GlitchScreen, ImpactCard
│       ├── screens/           # Dashboard, Leaderboard, RewardClaim, Onboarding
│       ├── solana/            # Jupiter, Jito, Kamino, GoldRush, scoreRegistry, mwaWallet
│       ├── data/              # questionBank, dynamicQuestions (oracle + SHA-256)
│       ├── config/            # network.ts (Quicknode-first RPC)
│       ├── native/            # MindlockWarden.ts (typed native bridge)
│       └── theme/             # colors, typography, spacing
├── JUPITER_DX_REPORT.md       # Jupiter side track submission
├── KAMINO_DX_REPORT.md        # Kamino side track submission
├── QUICKNODE_DX_REPORT.md     # Quicknode side track submission
├── GOLDRUSH_DX_REPORT.md      # GoldRush side track submission
├── JITO_DX_REPORT.md          # Jito side track submission
├── Whitepaper.md              # Full project whitepaper
├── .env.example               # All required env vars documented
└── Mindlock-Release.apk       # Working demo APK for Seeker
```

---

## 🚀 Quick Start

See **[DEMO.md](DEMO.md)** for full setup instructions.

```bash
# 1. Clone
git clone https://github.com/mindlock-app/mindlock.git
cd mindlock

# 2. Environment
cp .env.example Mindlock/.env
# Fill in QUICKNODE_DEVNET_URL and GOLDRUSH_API_KEY (optional — falls back gracefully)

# 3. Install
cd Mindlock
npm install

# 4. Run on Seeker device
npx react-native run-android

# 5. Seed leaderboard (optional — requires WSL + Solana CLI)
cd ..
npm run seed
```

---

## 🏆 Hackathon Tracks

### Main Track
- **Consumer** — OS-level discipline enforcement on Solana Seeker

### Side Tracks (5 submissions)

| Track | Integration | Status |
|---|---|---|
| **Jupiter** | Swap V2 ExactOut + DX Report | ✅ Submitted |
| **Kamino (Eitherway)** | Scholarship yield vault + DX Report | ✅ Submitted |
| **Quicknode (Eitherway)** | RPC routing + DX Report | ✅ Submitted |
| **GoldRush** | Charity impact dashboard + DX Report | ✅ Submitted |
| **Jito** | MEV-protected bundle submission + DX Report | ✅ Submitted |
| **100xDevs** | Same project — open track | ✅ Submitted |

---

## 📄 Documentation

| Document | Contents |
|---|---|
| [Whitepaper.md](Whitepaper.md) | Full technical whitepaper — architecture, tokenomics, security model, roadmap |
| [DEMO.md](DEMO.md) | Step-by-step setup for judges and developers |
| [MANUAL_SETUP.md](MANUAL_SETUP.md) | Detailed Android/WSL/Solana toolchain setup |
| [.env.example](.env.example) | Environment variable documentation |

---

## 🔒 Security

- **Seed Vault HSM** — Private keys never leave the hardware secure element
- **NTP Time Verification** — Grace periods and Day Pass cannot be clock-spoofed
- **AES-256-GCM** — Day Pass expiry stored in EncryptedSharedPreferences
- **Quiz Oracle Hash** — SHA-256 content verification prevents question tampering
- **On-Chain Audit Trail** — Every quiz pass is attested on Solana with `QuizPassed` event
- **Jito MEV Protection** — All payment transactions submitted as private Jito Bundles

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ☕ and conviction for Colosseum Frontier 2026</strong>
</p>
