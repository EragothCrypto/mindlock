# Mindlock — Devnet Program Registry

> All programs are deployed and live on **Solana Devnet**.

## Programs

### Commitment Vault
- **Program ID:** `5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC`
- **Explorer:** https://explorer.solana.com/address/5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC?cluster=devnet
- **Deployed Slot:** 438028029
- **Description:** 7-day SOL stake commitment with daily check-in tracking. Users lock 0.1 SOL, complete daily quizzes for 7 days, and earn the bounty reward on completion.

### Score Registry
- **Program ID:** `A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx`
- **Explorer:** https://explorer.solana.com/address/A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx?cluster=devnet
- **Deployed Slot:** 455056333
- **Description:** On-chain leaderboard with quiz attestation. Emits `QuizPassed` events containing SHA-256 question set hash for verifiable proof-of-brain.
- **Leaderboard State:** Seeded with 10 players (ProofOfBram → NewComer), GlobalStats epoch 1 active.

## Wallets

### Charity Wallet
- **Address:** `AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1`
- **SNS Domain:** `telagacharity.sol`
- **Explorer:** https://explorer.solana.com/address/AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1?cluster=devnet
- **Receives:** 40% of Lazy Unlock fees + 50% of Day Pass fees

### Upgrade Authority
- **Address:** `FT5k3k5yhp8rzw2YN948dhRNvSvbTYmWjmttY41Wnses`
- **Owns:** Both programs (commitment_vault + score_registry)

## Tooling

| Tool | Version |
|---|---|
| Solana CLI | 3.0.13 (Agave) |
| Anchor CLI | 0.30.1 |
| Rust | 1.79+ |
| Node.js | 18+ |

## Quick Verify

```bash
# Check commitment_vault
solana program show 5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC --url devnet

# Check score_registry
solana program show A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx --url devnet

# Check charity wallet balance
solana balance AEPXPKxWbKAspcK9XMwc2kiwDJnzCzaqL31NbSLtq5k1 --url devnet
```
