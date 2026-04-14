# MINDLOCK — Official Whitepaper
### Version 1.0 — March 2026

> *"The world's first Hard-Lock productivity app. Powered by Solana Mobile & the Seeker phone."*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Problem: Brain-Rot Epidemic](#2-the-problem-brain-rot-epidemic)
3. [The Solution: Hard-Lock with Knowledge Proof](#3-the-solution-hard-lock-with-knowledge-proof)
4. [Core Features & Highlights](#4-core-features--highlights)
5. [Technical Architecture](#5-technical-architecture)
6. [The $SKR Token Economy](#6-the-skr-token-economy)
7. [Karma System](#7-karma-system)
8. [Leaderboard & Scholarship Program](#8-leaderboard--scholarship-program)
9. [Escape Options: Lazy Unlock & Day Pass](#9-escape-options-lazy-unlock--day-pass)
10. [Security Model](#10-security-model)
11. [Roadmap](#11-roadmap)
12. [Team & Vision](#12-team--vision)

---

## 1. Executive Summary

**Mindlock** is the world's first OS-level, blockchain-gated productivity application built exclusively for the **Solana Mobile Seeker** device. Unlike traditional screen-time apps that users bypass in seconds, Mindlock uses the Seeker's **Seed Vault** hardware wallet and the **Mobile Wallet Adapter (MWA)** to enforce a cryptographic proof-of-knowledge barrier before granting access to any blocked "brain-rot" application.

Every time you try to open TikTok, Instagram, or any blocked app, Mindlock intercepts the launch at the Android OS level and presents a quiz. You must answer **3 Solana-ecosystem questions** (2 Easy + 1 Hard) all correctly to earn a grace period. No backdoor. No easy bypass.

**Mindlock is not just a productivity tool — it is a self-improvement engine with a charitable soul:**
- Every "lazy unlock" payment goes **100% to charity funds** (via on-chain redistribution)
- Top performers earn **$SKR scholarship rewards** from a weekly community pool
- A live **Karma leaderboard** gamifies discipline into a competitive, rewarding experience

**Built on:** React Native · Kotlin (Android Native) · Solana · Anchor Framework · $SKR Token · Seeker Seed Vault

---

## 2. The Problem: Brain-Rot Epidemic

The average person spends **4–7 hours per day** on social media. Existing "solutions" fail for a simple reason: they are trivially bypassed.

| Problem | Current Apps | Mindlock |
|---|---|---|
| User bypasses block | ✗ Uninstall app / change settings | ✓ OS-level intercept, cannot bypass |
| No learning incentive | ✗ Just timers | ✓ Proves Solana knowledge to unlock |
| No accountability mechanism | ✗ Private, no consequences | ✓ On-chain Karma, public leaderboard |
| No value created from failure | ✗ $0 impact | ✓ $1.50 SKR → 100% charity / scholarship |
| Cannot be "cheated" on Seeker | ✗ N/A | ✓ Hardware Seed Vault gating |

Social media companies spend billions optimizing for addiction. Mindlock is the first app that turns that addiction into **education and charity**.

---

## 3. The Solution: Hard-Lock with Knowledge Proof

### How the Lock Works

```
User opens TikTok
        ↓
WardenService detects (via UsageStatsManager, 2-second poll)
        ↓
MindlockQuizActivity launches as full-screen overlay
        ↓
3 Questions: 2 EASY + 1 HARD (randomized from bank)
        ↓
All 3 correct → Grace Period granted (30–45 min)
Any wrong → Reset entire round
        ↓
2 failed rounds → Escape Options appear:
    💸 Lazy Unlock ($1.50 SKR → charity)
    🛡️ Day Pass (500 SKR → 24h shield)
```

### Why this is Unbypassable
- The Warden runs as an **Android Foreground Service** — it survives app minimization, screen lock, and reboot
- The quiz overlay uses Android `FLAG_SHOW_WHEN_LOCKED` + `DisplayOverApps` window type — it appears **on top of every app on the device**
- The Seed Vault biometric check gates wallet connection — **no wallet = no setup**
- All timestamps use **NTP (time.google.com)** — changing system clock does not extend grace periods or bypass Day Pass cooldowns

---

## 4. Core Features & Highlights

### 4.1 The Warden — OS-Level App Interception
- Monitors foreground app every **2 seconds** using Android `UsageStatsManager`
- Maintains a **blocklist** of user-selected packages stored in encrypted local preferences (`WardenPreferences`)
- Distinguishes between grace period (post-quiz) and Day Pass shield — no quiz during active protection windows
- Foreground notification keeps the service alive by Android's OS rules

### 4.2 Knowledge Quiz Overlay
- **3 questions required** — 2 randomly drawn from Easy pool, 1 from Hard pool
- Any wrong answer **resets the entire round** (strict — no partial credit)
- After **2 failed complete rounds**, Escape Options are revealed
- Uses Android native Views (no React Native bridge) for maximum overlay speed and reliability
- Questions cover Solana ecosystem, $SKR token, Proof of History, Anchor framework, Seeker hardware, and more
- Question bank grows over time with dynamic question loading support (`dynamicQuestions.ts`)

### 4.3 Dashboard
Live statistics updated on every foreground event:

| Stat | Description |
|---|---|
| **QUIZZES ✓** | Total quizzes passed (all-time) |
| **GRACE LEFT ⏱** | Live countdown to grace period expiry |
| **🛡️ SHIELD** | Day Pass remaining time (gold when active) |
| **ACCURACY** | Percentage of correct first-attempt answers |
| **STREAK 🔥** | Current daily quiz streak |
| **FOCUS SCORE** | Composite leaderboard ranking score |
| **Karma Level** | Current charity tier badge (Newcomer → Saint) |

### 4.4 App Picker
- Lists **all installed user apps** via Android `PackageManager.getInstalledPackages()` — including apps without a launcher icon (e.g. TikTok on some ROMs)
- Filters out pure system apps (`FLAG_SYSTEM` without `FLAG_UPDATED_SYSTEM_APP`)
- Persisted to on-device encrypted storage

### 4.5 Wallet Integration (Seeker MWA)
- Uses **Solana Mobile Wallet Adapter (MWA)** via `@solana-mobile/mobile-wallet-adapter-protocol-web3js`
- Connects directly to the Seeker's built-in **Seed Vault** — no external wallet app required
- MWA returns the public key as a **base64-encoded string** (decoded via `Buffer.from(addr, 'base64')` → `PublicKey`)
- Wallet address displayed on dashboard in shortened `XXXX...XXXX` format

### 4.6 Claim $SKR Screen
- Displays the user's share of the community scholarship pool based on their **Focus Score**
- Calculates reward share proportionally: `userScore / totalGlobalScore * vaultBalance`
- Claim triggers a **Seed Vault biometric confirmation** (fingerprint haptic "thump")
- Epoch countdown shows time until next distribution

---

## 5. Technical Architecture

### 5.1 Stack Overview

```
┌─────────────────────────────────────────────┐
│              REACT NATIVE (JS/TS)            │
│  App.tsx · Screens · Hooks · Solana Clients  │
├─────────────────────────────────────────────┤
│           KOTLIN NATIVE BRIDGE               │
│  MindlockWardenModule  ← React Native Bridge │
│  DayPassModule         ← React Native Bridge │
├─────────────────────────────────────────────┤
│           ANDROID NATIVE (Kotlin)            │
│  WardenService   - Foreground app monitor    │
│  MindlockQuizActivity - Quiz overlay         │
│  WardenPreferences - Encrypted local prefs  │
│  DayPassModule - NTP-verified shield timer  │
├─────────────────────────────────────────────┤
│           SOLANA BLOCKCHAIN                  │
│  Commitment Vault Program (Anchor/Rust)      │
│  $SKR SPL Token · Redistribution Agent      │
│  Leaderboard Client · Karma Tracker         │
└─────────────────────────────────────────────┘
```

### 5.2 Native Modules

#### `MindlockWardenModule.kt`
Exposed to React Native via the bridge:

| Method | Description |
|---|---|
| `initializeWarden(blockedApps)` | Sets up blocked app list, starts monitoring |
| `startWardenService()` | Launches Android foreground service |
| `stopWardenService()` | Terminates monitoring |
| `getStatus()` | Returns `{ totalQuizzes, remainingGraceSeconds, ... }` |
| `grantGracePeriod()` | Stamps `lastUnlockTimestamp = now` → allows access |
| `getEscapeAction()` | Reads + clears MainActivity escape intent extra |
| `getInstalledApps()` | Full installed package list (non-system only) |
| `requestUsageStatsPermission()` | Opens Android Usage Access settings |
| `hasUsageStatsPermission()` | Checks if permission granted |

#### `DayPassModule.kt`
NTP-secured 24-hour access shield:

| Method | Description |
|---|---|
| `activateDayPass()` | Writes NTP expiry to encrypted + plain prefs, freezes streak |
| `canPurchase()` | Checks 7-day cooldown via NTP timestamp |
| `isShieldActive()` | Returns true if `now < shieldExpiry` |
| `getStatus()` | Returns `{ isShieldActive, shieldRemainingMs, cooldownRemainingMs, canPurchase }` |

**Security:** `EncryptedSharedPreferences` (AES-256-GCM) stores the authoritative expiry. A plain-prefs mirror is written alongside for `WardenService` to read without decryption overhead. NTP time from `time.google.com` prevents clock manipulation.

#### `WardenPreferences.kt`
Local config storage:
- `blockedApps: Set<String>` — package names
- `lastUnlockTimestamp: Long` — grace period start
- `gracePeriodMinutes: Int` — 30 min (standard) / 45 min (Guardian Delegator)
- `totalQuizzes: Int` — lifetime quiz pass count
- `isGuardianDelegator: Boolean` — extended grace unlocked by $SKR staking

### 5.3 WardenService — App Monitoring Loop

```kotlin
// Poll every 2 seconds
fun checkForegroundApp() {
    val pkg = getForegroundPackage()          // via UsageStatsManager
    if (!prefs.isAppBlocked(pkg)) return      // not in blocklist
    if (shieldActive(dayPassPlainPrefs)) return // Day Pass active → skip
    if (!prefs.isGracePeriodExpired()) return  // still in grace period
    launchQuizActivity(pkg)                   // show quiz overlay
}
```

### 5.4 Frontend Architecture

```
App.tsx
├── OnboardingScreen      — First-launch value proposition
├── SetupTutorialScreen   — 5-step guided setup
│   ├── Step 1: Connect Wallet (MWA)
│   ├── Step 2: Select Apps (AppPickerScreen)
│   ├── Step 3: Grant Permissions (Usage + Overlay)
│   ├── Step 4: Charity & Karma info
│   └── Step 5: Activate Warden
├── DashboardScreen       — Live stats + karma + wallet
├── AppPickerScreen       — Install app list picker
├── RewardClaimScreen     — $SKR earnings + Escape Options
├── LeaderboardScreen     — Global rankings + tier badges
└── HardwareVerificationScreen — Seeker NFT gating (mainnet)
```

### 5.5 Solana On-Chain Components

#### Commitment Vault Program (`programs/commitment_vault/`)
- Written in **Rust** using the **Anchor framework**
- Manages the scholarship reward vault on-chain
- Handles `claim_reward` instructions with Merkle proof verification
- PDAs for `user_score` and `global_stats` accounts

#### Redistribution Agent (`redistributionAgent.ts`)
Handles fee splitting:
```
Lazy Unlock ($1.50 USD in $SKR)
   ├── 40% → CHARITY_WALLET (direct donation, earns Karma)
   └── 60% → SCHOLARSHIP_FUND (weekly distribution pool)
```

#### $SKR Token Integration
- SPL Token standard on Solana
- Jupiter aggregator for USD → $SKR price discovery (mainnet)
- Associated token accounts created automatically on first interaction
- `SKR_DECIMALS = 6` (micro-SKR precision)

---

## 6. The $SKR Token Economy

```
                    USER ACTIONS
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    Quiz Passed    Lazy Unlock    Day Pass
    (free unlock)  ($1.50 SKR)  (500 SKR)
          │              │              │
          │         ┌────┴────┐         │
          │         │         │         │
          │      40% Charity  60% Scholarship
          │         │         │         │
          ↓         ↓         ↓         ↓
    Grace Period  Karma    Weekly    24h Shield
    (30-45 min)  Score    Pool      Activated
                  ↑
          Boosts leaderboard rank
```

### Token Flows
| Source | Amount | Destination |
|---|---|---|
| Lazy Unlock | $1.50 in $SKR | 40% charity + 60% scholarship |
| Day Pass | 500 $SKR | Shield activation fee (protocol) |
| Weekly rewards | Epoch pool | Top 1% / 10% / 25% by Focus Score |

---

## 7. Karma System

Karma measures a user's **total charitable contribution** to the ecosystem. Every Lazy Unlock payment earns Karma points proportional to the $SKR donated.

### Karma Levels

| Level | Threshold | Badge | Color |
|---|---|---|---|
| Newcomer | 0 Karma | 🌱 | Grey |
| Supporter | 5 Karma | 💚 | Light Green |
| Guardian | 25 Karma | 🛡️ | Green |
| Champion | 100 Karma | ⭐ | Amber |
| Hero | 500 Karma | 🦸 | Gold |
| Legend | 2,000 Karma | 👑 | Purple |
| Saint | 10,000 Karma | 😇 | Pink |

### Karma Boost
- Active for **24 hours** after any charitable donation
- Multiplier: **×1.2** on leaderboard Focus Score calculation
- Displayed as a live countdown badge on the dashboard and leaderboard

---

## 8. Leaderboard & Scholarship Program

### Focus Score Formula
```
Focus Score =
  (quizAccuracy × 40%)
+ (currentStreak × 30%)
+ (focusMinutes × 20%)
+ (karmaBoostMultiplier × 10%)
```

### Reward Tiers (Weekly Epoch)

| Tier | Percentile | Pool Share | Icon |
|---|---|---|---|
| **Diamond Sage** | Top 1% | 40% of pool | 💎 |
| **Emerald Scholar** | Top 10% | 30% of pool | 💚 |
| **Steel Discipline** | Top 25% | 20% of pool | ⚔️ |
| *(Remainder)* | — | 10% → charity | ❤️ |

- Rewards distributed at end of each **weekly epoch** via on-chain transaction
- Claimed directly to user's Seed Vault with biometric confirmation
- Real-time epoch countdown displayed on dashboard and leaderboard

---

## 9. Escape Options: Lazy Unlock & Day Pass

When a user fails the quiz **twice in a row**, two escape hatches appear:

### 💸 Lazy Unlock
- **Cost:** $1.50 USD in $SKR (Jupiter price-converted at time of purchase)
- **Effect:** Grants the standard grace period (30–45 min) immediately
- **Charitable split:** 40% direct charity donation / 60% scholarship fund
- **Karma reward:** Earns Karma proportional to donation (boosts leaderboard rank)
- **On-chain:** SPL token transfer via Solana Mobile Wallet Adapter + Seed Vault biometric

### 🛡️ Day Pass
- **Cost:** 500 $SKR
- **Effect:** Full 24-hour shield — no quiz for any blocked app
- **Cooldown:** 7-day wait between purchases (enforced by NTP timestamps in EncryptedSharedPreferences)
- **Streak protection:** Freezes the user's daily quiz streak (doesn't break it during shield)
- **Dashboard indicator:** Gold ⏱ countdown shows remaining shield time in real-time
- **Security:** Expiry stored in AES-256-GCM EncryptedSharedPreferences; NTP-verified on both activation and check

---

## 10. Security Model

| Threat | Mitigation |
|---|---|
| Change system clock to bypass grace | NTP time on all critical timestamps |
| Uninstall app to avoid quiz | Android system-level overlay — can't open blocked app without passing quiz first |
| Clear app data to reset counters | Encrypted SharedPreferences (AES-256-GCM) for Day Pass, grace period |
| Use another device / account | MWA wallet address tied to Seed Vault HSM — non-exportable keys |
| Fake wallet connection | MWA protocol enforces biometric confirmation for every transaction |
| Tamper with quiz answers | Quiz runs in native Activity, not in WebView — no JS injection |
| Root access exploitation | Future: SafetyNet/Play Integrity API attestation (Roadmap Q3 2026) |

---

## 11. Roadmap

### ✅ v1.0 — Foundation (Live, Q1 2026)
- [x] OS-level app interception (WardenService + UsageStatsManager)
- [x] Native quiz overlay (MindlockQuizActivity)
- [x] 3-question format (2 Easy + 1 Hard, full quiz reset on wrong answer)
- [x] Seeker MWA wallet connection via Seed Vault
- [x] App Picker (all installed apps including non-launcher apps)
- [x] Usage Access + Display Over Other Apps permissions
- [x] Grace period system (30–45 min post-quiz)
- [x] Lazy Unlock ($1.50 SKR → charity + scholarship)
- [x] Day Pass (500 SKR, 24h shield, 7-day NTP cooldown)
- [x] Dash live stats (quizzes, grace timer, shield timer)
- [x] Karma system (7 tiers, Karma Boost ×1.2)
- [x] Leaderboard with Focus Score formula
- [x] Scholarship claim with Seed Vault biometric sign
- [x] Custom neon-green icon set (21 icons)
- [x] Branded Mindlock app icon (neon padlock + Solana logo)
- [x] **Jupiter Swap V2** — ExactOut charity fee, dynamic slippage, price impact gate
- [x] **Kamino Finance** — Scholarship vault yield display, live APY fetching
- [x] **Quicknode RPC** — Env-var first routing with automatic public fallback
- [x] **GoldRush Impact Dashboard** — Live charity transaction feed with USD pricing
- [x] **Quiz Oracle Hash** — SHA-256 content verification; on-chain attestation via `QuizPassed` event
- [x] **Question Explanations** — "HERE'S WHY" learning cards on every wrong answer
- [x] **Score Registry** — On-chain leaderboard program (deployed, seeded with 10 players)
- [x] **Commitment Vault** — 7-day SOL stake lock (deployed, live on devnet)
- [x] **Jito Bundles** — MEV-protected atomic bundle submission for Lazy Unlock + Day Pass payments

#### Devnet Deployment (Verified)

| Program | Address | Slot |
|---|---|---|
| commitment_vault | `5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC` | 438028029 |
| score_registry | `A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx` | 455056333 |
| charity_wallet | `AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1` (telagacharity.sol) | — |

---

### 🔜 v1.1 — Social & Refinement (Q2 2026)
- [ ] **Guardian Delegator integration** — $SKR staking unlocks 45-min grace period and leaderboard badge
- [ ] **Push notifications** — Streak reminders ("Day 7 at risk!"), epoch ending soon alerts
- [ ] **Quiz answer analytics** — Track what topics users struggle with; suggest learning paths
- [ ] **Solana Mobile dApp Store listing** — Official submission and review
- [ ] **Mainnet deployment** — Commitment Vault Anchor program + leaderboard program, real $SKR on mainnet
- [ ] **Seeker Genesis NFT verification** — Gate premium features to NFT holders on mainnet (existing `useSeekerVerification` hook ready)

---

### 🚀 v2.0 — Social Accountability Layer (Q3 2026)
- [ ] **Accountability Pods** — Groups of 3–5 friends that can see each other's real-time quiz/streak stats
- [ ] **Challenge Mode** — Send a "quiz challenge" to a friend; loser buys winner a Day Pass
- [ ] **Guild System** — Form discipline guilds, earn combined Karma for group charity donations
- [ ] **Share Streak Card** — Generate a shareable image: "Day 21 streak on Mindlock 🔒"
- [ ] **SafetyNet / Play Integrity** — Root detection to prevent kernel-level bypasses
- [ ] **iOS support** — Port to iOS using Screen Time API + PushKit for quiz triggers
- [ ] **Custom Quiz Topics** — Allow users to set quiz topics beyond Solana: DeFi, NFTs, history, science

---

### 🌐 v2.5 — Education Marketplace (Q4 2026)
- [ ] **Question NFTs** — Community-created quiz questions minted as NFTs; creators earn a % of Lazy Unlock fees when their question is used
- [ ] **Study Mode** — Turn the daily quiz into a structured learning session with explanations and links
- [ ] **Micro-Certification** — On-chain credential NFT for completing 30-day streak: "Certified Solana Disciplinarian"
- [ ] **Course Integration** — Partner with Solana Bootcamp / Superteam to serve certified course questions
- [ ] **Dynamic Difficulty** — AI-powered difficulty scaling: harder questions as user's mastery increases

---

### 🏛️ v3.0 — DAO & Protocol Governance (Q1 2027)
- [ ] **MindlockDAO** — $SKR holders vote on charity recipients, scholarship pool size, and new features
- [ ] **Community Charity Voting** — Each epoch, top Karma holders vote on which charity receives the fund
- [ ] **Protocol Fee Switch** — Governance vote to adjust fee splits (currently 40% charity / 60% scholarship)
- [ ] **Cross-Chain Expansion** — Support for other Solana Mobile devices and eventually non-Seeker Android via a paid tier
- [ ] **Enterprise Mode** — B2B offering: companies deploy Mindlock for employees, track focus metrics on a company dashboard
- [ ] **Parental Control Mode** — Guardian wallet (parent) sets quiz difficulty and app blocklist for a child wallet; child earns $SKR for passing

---

### 🔮 v4.0 — AI-Powered Discipline Engine (Q2–Q3 2027)
- [ ] **AI Habit Coach** — On-device LLM analyzes usage patterns and suggests optimal block schedules and question difficulty
- [ ] **Biometric Focus Score** — Optional integration with Seeker health sensors (HRV, focus state) to validate real cognitive engagement
- [ ] **Adaptive Quiz Generation** — LLM generates personalized questions based on user's knowledge gaps and interests
- [ ] **Mindlock Score™ API** — Public API for apps and employers to verify a user's Mindlock discipline credentials on-chain
- [ ] **zkProof Integration** — Zero-knowledge proof that a user passed the quiz without revealing quiz content to third parties

---

## 12. Team & Vision

### Vision Statement
> *"Every minute you spend on brain-rot is a minute stolen from your future self. Mindlock turns that theft into education — and your failure into charity."*

Mindlock is built on the belief that the Seeker phone represents a paradigm shift: a device where your hardware wallet is your identity, and your attention is your asset. We are the first application to weaponize that identity for self-discipline.

### Technology Partners
- **Solana Mobile** — Seed Vault integration, MWA protocol
- **Solana Foundation** — dApp Store deployment, devnet infrastructure
- **Seeker Community / $SKR** — Token economy, Guardian staking meta

### Contact & Community
- **GitHub:** github.com/mindlock-app
- **Twitter / X:** @MindlockApp
- **Discord:** discord.gg/mindlock
- **dApp Store:** Solana Mobile dApp Store (listing pending)

---

*© 2026 Mindlock. All rights reserved. This whitepaper is for informational purposes. $SKR token figures and program addresses are subject to change before mainnet launch.*
