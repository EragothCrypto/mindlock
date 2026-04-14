# Mindlock — score_registry Deploy Checklist
# Run these commands in WSL in order.

# ─────────────────────────────────────────────
# STEP 1: Navigate to project
# ─────────────────────────────────────────────
cd "/mnt/c/Coding Projects/Mindlock"

# ─────────────────────────────────────────────
# STEP 2: Build ONLY the new program
# (--program-name avoids rebuilding commitment_vault)
# ─────────────────────────────────────────────
anchor build --program-name score_registry

# Expected: target/deploy/score_registry.so created
# If you see errors about anchor-lang version, they should be 0.30.1 — already matches

# ─────────────────────────────────────────────
# STEP 3: Get the program address BEFORE deploy
# (used to update declare_id! and Anchor.toml)
# ─────────────────────────────────────────────
solana address -k target/deploy/score_registry-keypair.json

# Copy this address — you'll need it in the next 3 steps

# ─────────────────────────────────────────────
# STEP 4: Update declare_id! in lib.rs
# Replace 11111111111111111111111111111111 with the real address
# ─────────────────────────────────────────────
# Edit: programs/score_registry/src/lib.rs  line 9
# declare_id!("YOUR_REAL_ADDRESS_HERE");

# ─────────────────────────────────────────────
# STEP 5: Update Anchor.toml
# ─────────────────────────────────────────────
# Edit: Anchor.toml  line 10
# score_registry = "YOUR_REAL_ADDRESS_HERE"

# ─────────────────────────────────────────────
# STEP 6: Rebuild with the real ID baked in
# ─────────────────────────────────────────────
anchor build --program-name score_registry

# ─────────────────────────────────────────────
# STEP 7: Deploy to devnet
# ─────────────────────────────────────────────
anchor deploy --program-name score_registry --provider.cluster devnet

# ✅ You should see: "Program Id: YOUR_REAL_ADDRESS"
# ✅ Explorer: https://explorer.solana.com/address/YOUR_REAL_ADDRESS?cluster=devnet

# ─────────────────────────────────────────────
# STEP 8: Init GlobalStats PDA + seed leaderboard
# ─────────────────────────────────────────────
# First: update SCORE_REGISTRY_PROGRAM_ID in scripts/seedLeaderboard.ts
# Then from the Mindlock/Mindlock/ directory (React Native app root):
cd "/mnt/c/Coding Projects/Mindlock/Mindlock"
npx ts-node ../scripts/seedLeaderboard.ts

# ─────────────────────────────────────────────
# STEP 9: Update leaderboardClient.ts
# ─────────────────────────────────────────────
# Edit: Mindlock/src/solana/leaderboardClient.ts  L7-9
# export const LEADERBOARD_PROGRAM_ID = new PublicKey("YOUR_REAL_ADDRESS_HERE");
# Also fix the placeholder guard at L144:
#   const placeholderPrefix = 'YOUR_FIRST_8_CHARS'; // so it doesn't show "Be the first!"

# ─────────────────────────────────────────────
# DONE ✅
# The leaderboard is now live with 10 seeded players.
# Rebuild the APK and the leaderboard will show real ranked entries.
# ─────────────────────────────────────────────
