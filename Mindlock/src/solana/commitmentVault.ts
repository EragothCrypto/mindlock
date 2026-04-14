import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';

// Program ID (deployed to devnet)
export const COMMITMENT_VAULT_PROGRAM_ID = new PublicKey(
    '5capkwaV1E7s3j2ZRaXfLe9xK3pSV1crZwLFx6agvwEC'
);

// Constants matching the Anchor program
export const COMMITMENT_AMOUNT = 0.1 * LAMPORTS_PER_SOL; // 100,000,000 lamports
export const STREAK_DAYS_REQUIRED = 7;
export const BOUNTY_REWARD = 0.001 * LAMPORTS_PER_SOL; // 1,000,000 lamports
export const VAULT_SEED = 'commitment_vault';

// $SKR Burn Address (placeholder - replace with actual)
export const SKR_BURN_ADDRESS = new PublicKey(
    'SKRburn1111111111111111111111111111111111111'
);

// Commitment vault state interface
export interface CommitmentVaultState {
    user: PublicKey;
    amount: number;
    startTimestamp: number;
    daysCompleted: number;
    lastCheckin: number;
    isActive: boolean;
    bump: number;
}

export interface CommitmentStatus {
    exists: boolean;
    isActive: boolean;
    daysCompleted: number;
    daysRemaining: number;
    isComplete: boolean;
    isExpired: boolean;
    canCheckin: boolean;
    hoursUntilNextCheckin: number;
    hoursUntilExpiry: number;
}

/**
 * Commitment Vault TypeScript Client
 * 
 * Interacts with the on-chain Commitment Vault program for
 * the Stake-to-Snooze feature.
 */
export class CommitmentVaultClient {
    private connection: Connection;

    constructor(rpcUrl?: string) {
        this.connection = new Connection(
            rpcUrl || NETWORK_CONFIG.rpcUrl,
            'confirmed'
        );
    }

    /**
     * Derive the vault PDA for a user
     */
    async getVaultPDA(userPubkey: PublicKey): Promise<[PublicKey, number]> {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(VAULT_SEED), userPubkey.toBuffer()],
            COMMITMENT_VAULT_PROGRAM_ID
        );
    }

    /**
     * Get commitment status for a user
     */
    async getCommitmentStatus(userPubkey: PublicKey): Promise<CommitmentStatus> {
        const [vaultPDA] = await this.getVaultPDA(userPubkey);
        const accountInfo = await this.connection.getAccountInfo(vaultPDA);

        if (!accountInfo) {
            return {
                exists: false,
                isActive: false,
                daysCompleted: 0,
                daysRemaining: 7,
                isComplete: false,
                isExpired: false,
                canCheckin: false,
                hoursUntilNextCheckin: 0,
                hoursUntilExpiry: 0,
            };
        }

        // Parse account data (skip 8-byte discriminator)
        const data = accountInfo.data.slice(8);
        const state = this.parseVaultState(data);

        const now = Math.floor(Date.now() / 1000);
        const hoursSinceCheckin = (now - state.lastCheckin) / 3600;

        return {
            exists: true,
            isActive: state.isActive,
            daysCompleted: state.daysCompleted,
            daysRemaining: STREAK_DAYS_REQUIRED - state.daysCompleted,
            isComplete: state.daysCompleted >= STREAK_DAYS_REQUIRED,
            isExpired: hoursSinceCheckin >= 48,
            canCheckin: hoursSinceCheckin >= 24 && state.daysCompleted < STREAK_DAYS_REQUIRED,
            hoursUntilNextCheckin: Math.max(0, 24 - hoursSinceCheckin),
            hoursUntilExpiry: Math.max(0, 48 - hoursSinceCheckin),
        };
    }

    /**
     * Parse vault state from account data
     */
    private parseVaultState(data: Uint8Array & { readBigUInt64LE: (offset: number) => bigint; readBigInt64LE: (offset: number) => bigint; readUInt8: (offset: number) => number; slice: (start: number, end: number) => Uint8Array }): CommitmentVaultState {
        // Layout:
        // user: 32 bytes
        // amount: 8 bytes (u64)
        // start_timestamp: 8 bytes (i64)
        // days_completed: 1 byte (u8)
        // last_checkin: 8 bytes (i64)
        // is_active: 1 byte (bool)
        // bump: 1 byte (u8)

        let offset = 0;

        const user = new PublicKey(data.slice(offset, offset + 32));
        offset += 32;

        const amount = Number(data.readBigUInt64LE(offset));
        offset += 8;

        const startTimestamp = Number(data.readBigInt64LE(offset));
        offset += 8;

        const daysCompleted = data.readUInt8(offset);
        offset += 1;

        const lastCheckin = Number(data.readBigInt64LE(offset));
        offset += 8;

        const isActive = data.readUInt8(offset) === 1;
        offset += 1;

        const bump = data.readUInt8(offset);

        return {
            user,
            amount,
            startTimestamp,
            daysCompleted,
            lastCheckin,
            isActive,
            bump,
        };
    }

    /**
     * Build create_commitment instruction data
     */
    buildCreateCommitmentIx(): Uint8Array {
        // Anchor instruction discriminator for "create_commitment"
        // This is derived from: sha256("global:create_commitment")[0..8]
        const discriminator = Buffer.from([
            0x18, 0x2e, 0xf4, 0x99, 0x07, 0x83, 0x37, 0xa4
        ]);
        return discriminator;
    }

    /**
     * Build daily_checkin instruction data
     */
    buildDailyCheckinIx(): Uint8Array {
        // Anchor instruction discriminator for "daily_checkin"
        const discriminator = Buffer.from([
            0xd5, 0x5c, 0x8a, 0x1d, 0x8e, 0x4f, 0x5b, 0x2c
        ]);
        return discriminator;
    }

    /**
     * Build release_funds instruction data
     */
    buildReleaseFundsIx(): Uint8Array {
        // Anchor instruction discriminator for "release_funds"
        const discriminator = Buffer.from([
            0x9a, 0x3e, 0x7f, 0x2d, 0x1c, 0x8b, 0x4a, 0x5e
        ]);
        return discriminator;
    }

    /**
     * Build burn_stake instruction data
     */
    buildBurnStakeIx(): Uint8Array {
        // Anchor instruction discriminator for "burn_stake"
        const discriminator = Buffer.from([
            0x6f, 0x8d, 0x2b, 0x4c, 0x9e, 0x7a, 0x3f, 0x1d
        ]);
        return discriminator;
    }

    /**
     * Format lamports as SOL string
     */
    formatSOL(lamports: number): string {
        return (lamports / LAMPORTS_PER_SOL).toFixed(4) + ' SOL';
    }
}

// Export singleton instance
export const commitmentVault = new CommitmentVaultClient();
export default commitmentVault;
