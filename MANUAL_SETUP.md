# Mindlock Manual Setup Guide

This document lists all configuration you must complete manually before deploying Mindlock.

---

## 1. GitHub Gist for Dynamic Questions

**Purpose:** Update quiz questions without app store releases.

### Steps:
1. Go to [gist.github.com](https://gist.github.com)
2. Create a **public** Gist with filename: `mindlock-questions.json`
3. Copy content from: `src/data/example-gist-questions.json`
4. Click "Create public gist"
5. Click "Raw" button and copy the URL

### Configure:
Edit `src/data/dynamicQuestions.ts`:
```typescript
const GIST_RAW_URL = 'https://gist.githubusercontent.com/YOUR_USERNAME/GIST_ID/raw/mindlock-questions.json';
```

---

## 2. $SKR Token Mint Address

**Purpose:** Jupiter swap and vault integration.

### Get Address:
- Check official Solana Mobile docs for $SKR token mint
- Or search on [solscan.io](https://solscan.io)

### Configure:
Edit `src/solana/jupiterSwap.ts`:
```typescript
export const SKR_TOKEN_MINT = new PublicKey('ACTUAL_SKR_MINT_ADDRESS');
```

---

## 3. Anchor Program Deployment

**Purpose:** Deploy Commitment Vault to Solana.

### Steps:
```bash
cd "c:\Coding Projects\Mindlock"

# Ensure you have SOL for deployment
solana balance

# Build program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Copy the deployed Program ID
```

### Configure:
Update Program ID in:
- `programs/commitment_vault/src/lib.rs` (line 10)
- `src/solana/commitmentVault.ts` (line 10)
- `Anchor.toml` (programs.devnet section)

---

## 4. Reward Vault Address

**Purpose:** Receive $SKR from Lazy Unlock swaps.

### Option A: Program PDA
After deploying, derive the vault PDA:
```typescript
const [vaultPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from('reward_vault')],
  COMMITMENT_VAULT_PROGRAM_ID
);
```

### Option B: Dedicated Wallet
Create a new wallet specifically for the vault.

### Configure:
Edit `src/solana/jupiterSwap.ts`:
```typescript
export const REWARD_VAULT_ADDRESS = new PublicKey('YOUR_VAULT_ADDRESS');
```

---

## 5. App Authority Keypair

**Purpose:** Signs daily check-ins (prevents user self-signing).

### Generate:
```bash
solana-keygen new --outfile ~/.config/solana/mindlock-authority.json
```

### Store Securely:
- For devnet: Keep locally
- For production: Use secure backend or oracle service

### Fund Account:
```bash
solana airdrop 1 ~/.config/solana/mindlock-authority.json --url devnet
```

---

## 6. Android Permissions

**Purpose:** Grant usage stats access on device.

### Steps (on device/emulator):
1. Open Mindlock app
2. When prompted, tap "Grant Permission"
3. In Settings, find Mindlock in the list
4. Toggle ON "Permit usage access"

---

## 7. Leaderboard Backend (Optional)

**Purpose:** Aggregate user stats across devices for global leaderboard.

### Options:
- **Simple:** Use a Firebase Realtime Database
- **Decentralized:** Store stats on-chain in user PDAs
- **Hybrid:** Periodically sync local stats to backend

### Data to Sync:
```json
{
  "wallet": "...",
  "accuracy": 92.5,
  "longestStreak": 14,
  "earnedUnlocks": 28,
  "lastUpdated": "2026-01-26T..."
}
```

---

## Checklist

| Item | Status |
|------|--------|
| GitHub Gist URL | ✅ |
| $SKR Token Mint | ✅ |
| Anchor Deployment | ✅ `5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC` |
| Program ID Updated | ✅ |
| Reward Vault Address | ✅ `FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses` |
| App Authority Keypair | ✅ `6c4rjMrm6jq1hAgboXdBxj31HHNqXGG1r2DwFpXwyAUd` |
| Android Permission | ⬜ (grant on device) |
| Leaderboard Backend | ⬜ (optional) |

---

## Quick Test

```bash
# 1. Start Metro bundler
cd "c:\Coding Projects\Mindlock\Mindlock"
npm start

# 2. Run on Android
npx react-native run-android

# 3. Test quiz flow
# 4. Grant usage access permission
# 5. Start Warden service
# 6. Open TikTok → Quiz should appear!
```
## Final Prompts

1. The "Chaos Warden" Bug-Testing Script

Paste this into the Antigravity Test Agent. It is designed to find every loophole a lazy user might use to bypass your lock.

    Prompt: "Act as a QA Engineer and Android Security Researcher. Run a comprehensive stress-test on the Mindlock Devnet build. Specifically, test and fix these edge cases:

        The Force-Close: If the user kills the Mindlock app from the 'Recent Apps' menu during a quiz, does the Warden Service restart immediately? (Ensure START_STICKY is implemented in Kotlin).

        The Overlay Dodge: If the user tries to use 'Split Screen' mode or 'Picture-in-Picture' to see the blocked app behind the quiz, does the Warden detect and block the second window?

        The Permission Revoke: If a user manually goes to Android Settings and revokes Usage Stats while the Warden is running, how does the app react? (It should show a persistent, non-dismissible system alert).

        Wallet Disconnect: If the user disconnects their wallet midway through a 'Lazy Unlock' transaction, ensure the SOL/SKR isn't stuck in a 'pending' state in the UI.

        Reboot Survival: Does the Warden Service start automatically on device boot without requiring the user to open the app first?

        Transaction Failure: If the Jupiter Swap fails due to slippage on Devnet, does the app gracefully return the user to the quiz instead of locking them out entirely?

    Output: A 'Stability Report' and the necessary code patches for any failures found."

2. The "Monolith Documentation" Prompt

Documentation is 30% of your hackathon score. This prompt will make Antigravity generate a professional, "VC-ready" documentation suite.

    Prompt: "I am preparing my final submission for the Solana Mobile Monolith Hackathon. Based on the Mindlock codebase, generate a complete documentation package in a folder named /docs:

        README.md: A technical deep-dive. Include the 'Cyber-Brutalist' vision, the Anchor program ID, instructions for Devnet testing, and a list of the specific Solana Mobile Stack (SMS) features we utilized (Seed Vault, MWA).

        The Economic Whitepaper: A 1-page summary of the $SKR Circular Economy. Explain the 'Lazy Fee' split (50% Scholarship, 40% Burn, 10% Charity) and how it creates a token sink.

        User Manual: A 'vibe-heavy' guide for new Seeker owners. Explain 'How to set up your Warden' and 'How to earn your first Scholarship Reward.' Use bold, catchy headings.

        Pitch Deck Script: A slide-by-slide script for a 3-minute demo video. Focus on why this is a 'Blue Ocean' app for the dApp Store.

        Code Architecture Diagram: Generate a Mermaid.js diagram showing the interaction between the Android UsageStats, the React Native Frontend, and the Anchor Program on Devnet."