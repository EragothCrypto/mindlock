/**
 * Mindlock — Leaderboard Seed Script (Anchor Client version)
 *
 * Uses @coral-xyz/anchor with the local IDL so discriminators are computed
 * automatically — no manual byte-packing needed.
 *
 * Run from repo root in WSL after deploying score_registry:
 *   cd /mnt/c/Coding\ Projects/Mindlock
 *   npx ts-node scripts/seedLeaderboard.ts
 *
 * Prerequisites:
 *   - anchor build already run (IDL at target/idl/score_registry.json)
 *   - Funded devnet wallet at ~/.config/solana/id.json
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// CONFIG
// ============================================================================

const SCORE_REGISTRY_PROGRAM_ID = new PublicKey(
    'A2n66MaKH2KhcJJnnBfh56VrmATAA8kPt7iXq5QEQTAx'
);

const DEVNET_RPC = 'https://api.devnet.solana.com';

// Seeds (must match program)
const USER_SCORE_SEED = Buffer.from('user_score');
const GLOBAL_STATS_SEED = Buffer.from('global_stats');

// Realistic test players — diverse streak/accuracy mix for a good leaderboard
const TEST_PLAYERS = [
    { name: 'ProofOfBram',   streak: 47, accuracy: 94, focusMinutes: 2340 },
    { name: 'SolanaMaxi',    streak: 31, accuracy: 88, focusMinutes: 1560 },
    { name: 'SeedVaultKing', streak: 28, accuracy: 96, focusMinutes: 1400 },
    { name: 'GlitchHunter',  streak: 22, accuracy: 79, focusMinutes: 1100 },
    { name: 'AnchorDev',     streak: 18, accuracy: 91, focusMinutes: 900  },
    { name: 'WardenWatch',   streak: 14, accuracy: 85, focusMinutes: 700  },
    { name: 'KarmaSaint',    streak: 11, accuracy: 72, focusMinutes: 550  },
    { name: 'QuizPasser',    streak: 7,  accuracy: 67, focusMinutes: 350  },
    { name: 'SeekrFan',      streak: 4,  accuracy: 60, focusMinutes: 200  },
    { name: 'NewComer',      streak: 1,  accuracy: 50, focusMinutes: 45   },
];

// ============================================================================
// HELPERS
// ============================================================================

function loadWallet(keyPath: string): Keypair {
    const raw = fs.readFileSync(keyPath, 'utf-8');
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function getGlobalStatsPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [GLOBAL_STATS_SEED],
        SCORE_REGISTRY_PROGRAM_ID
    );
}

function getUserScorePDA(wallet: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [USER_SCORE_SEED, wallet.toBuffer()],
        SCORE_REGISTRY_PROGRAM_ID
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log('\n🌱 Mindlock Leaderboard Seeder\n');

    // Wallet resolution — three options (first found wins):
    //  1. KEYPAIR_PATH env var:  KEYPAIR_PATH=/home/s3ntrylabs/.config/solana/id.json npm run seed
    //  2. ./authority.json in project root (copy with: cp ~/.config/solana/id.json authority.json)
    //  3. Fail with clear instructions
    const localOverride = path.resolve(__dirname, '..', 'authority.json');
    const keypairPath =
        process.env.KEYPAIR_PATH ||
        (fs.existsSync(localOverride) ? localOverride : null);

    if (!keypairPath) {
        console.error('❌ Cannot locate Solana keypair. Fix with one of:');
        console.error('\n   Option A — env var (recommended):');
        console.error('   KEYPAIR_PATH=/home/s3ntrylabs/.config/solana/id.json npm run seed');
        console.error('\n   Option B — copy keypair to project root:');
        console.error('   cp ~/.config/solana/id.json authority.json && npm run seed');
        process.exit(1);
        return;
    }

    const authorityKp = loadWallet(keypairPath);
    console.log(`   Wallet    : ${keypairPath}`);

    // Load IDL (built by anchor build)
    const idlPath = path.resolve(__dirname, '..', 'target', 'idl', 'score_registry.json');
    if (!fs.existsSync(idlPath)) {
        console.error(`❌ IDL not found at ${idlPath}`);
        console.error('   Run: anchor build --program-name score_registry');
        process.exit(1);
        return;
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

    // Patch IDL address to match deployed program — the build-time declare_id!
    // may differ from the actual deployed keypair address (A2n66...).
    // Anchor IDL v1 (0.30.x) uses metadata.address, IDL v2 (0.32.x) uses top-level address.
    const progIdStr = SCORE_REGISTRY_PROGRAM_ID.toString();
    if (idl.address !== undefined) idl.address = progIdStr;
    if (idl.metadata) idl.metadata.address = progIdStr;
    else idl.metadata = { address: progIdStr };

    // Set up Anchor provider
    const connection = new Connection(DEVNET_RPC, 'confirmed');
    const wallet = new Wallet(authorityKp);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    anchor.setProvider(provider);

    // anchor 0.30.x: Program(idl, provider) — program ID comes from patched IDL above
    const program = new Program(idl, provider) as any;

    console.log(`   Authority : ${authorityKp.publicKey.toString()}`);
    console.log(`   Program   : ${SCORE_REGISTRY_PROGRAM_ID.toString()}`);

    const balance = await connection.getBalance(authorityKp.publicKey);
    console.log(`   Balance   : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    if (balance < 0.3 * LAMPORTS_PER_SOL) {
        console.error('\n❌ Need at least 0.3 SOL:');
        console.error('   solana airdrop 2 --url devnet');
        process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Initialize GlobalStats PDA (one-time, authority only)
    // ─────────────────────────────────────────────────────────────────────────
    const [globalStatsPDA] = getGlobalStatsPDA();
    const globalExists = await connection.getAccountInfo(globalStatsPDA);

    if (!globalExists) {
        console.log('\n📊 Initializing GlobalStats PDA...');
        // First epoch ends in 7 days from now
        const epochEndMs = new BN(Date.now() + 7 * 24 * 60 * 60 * 1000);

        try {
            const sig = await program.methods
                .initGlobalStats(epochEndMs)
                .accounts({
                    authority: authorityKp.publicKey,
                    globalStats: globalStatsPDA,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([authorityKp])
                .rpc();

            console.log(`   ✅ GlobalStats initialized`);
            console.log(`   TX: https://explorer.solana.com/tx/${sig}?cluster=devnet\n`);
        } catch (err) {
            console.error('   ❌ Failed to init GlobalStats:', (err as Error).message);
            process.exit(1);
        }
    } else {
        console.log('\n   ✅ GlobalStats already initialized — skipping\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Seed each test player
    // ─────────────────────────────────────────────────────────────────────────
    console.log('🏆 Seeding test players...\n');

    for (const player of TEST_PLAYERS) {
        const playerKp = Keypair.generate();
        const [scorePDA] = getUserScorePDA(playerKp.publicKey);

        try {
            // Fund player wallet from authority (avoids devnet airdrop rate limits)
            const fundTx = new anchor.web3.Transaction().add(
                anchor.web3.SystemProgram.transfer({
                    fromPubkey: authorityKp.publicKey,
                    toPubkey: playerKp.publicKey,
                    lamports: 0.02 * LAMPORTS_PER_SOL,
                })
            );
            await anchor.web3.sendAndConfirmTransaction(connection, fundTx, [authorityKp]);

            // 1. init_user_score — creates the PDA
            await program.methods
                .initUserScore()
                .accounts({
                    user: playerKp.publicKey,
                    userScore: scorePDA,
                    globalStats: globalStatsPDA,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([playerKp])
                .rpc();

            // Small delay to avoid nonce reuse
            await sleep(500);

            // 2. submit_score — sets streak, accuracy, focus minutes
            // Build a deterministic fake question set hash from the player name
            const questionSetHash = Buffer.alloc(32);
            Buffer.from(player.name).copy(questionSetHash);

            const sig = await program.methods
                .submitScore(
                    player.focusMinutes,          // focus_minutes: u32
                    player.accuracy,               // accuracy: u32 (0-100)
                    Array.from(questionSetHash),   // question_set_hash: [u8; 32]
                    2                              // max_difficulty: u8 (Hard)
                )
                .accounts({
                    user: playerKp.publicKey,
                    userScore: scorePDA,
                    globalStats: globalStatsPDA,
                })
                .signers([playerKp])
                .rpc();

            const focusScore = Math.round(
                Math.pow(player.streak, 2) * (player.accuracy / 100)
            );

            console.log(
                `   ✅ ${player.name.padEnd(15)} ` +
                `streak=${String(player.streak).padStart(2)} ` +
                `acc=${player.accuracy}% ` +
                `score=${String(focusScore).padStart(5)} ` +
                `| ${sig.slice(0, 8)}...`
            );
        } catch (err) {
            console.warn(`   ⚠️  ${player.name}: ${(err as Error).message}`);
        }

        // Rate-limit friendly delay between players
        await sleep(1200);
    }

    console.log('\n✅ Leaderboard seeded! Summary:');
    console.log(`   Players seeded : ${TEST_PLAYERS.length}`);
    console.log(`   Program        : ${SCORE_REGISTRY_PROGRAM_ID.toString()}`);
    console.log(`   Explorer       : https://explorer.solana.com/address/${SCORE_REGISTRY_PROGRAM_ID.toString()}?cluster=devnet`);
    console.log('\n   Rebuild and sideload the APK — judges will see a live ranked leaderboard. 🚀\n');
}

main().catch(err => {
    console.error('\n❌ Seed script failed:', err.message);
    process.exit(1);
});
