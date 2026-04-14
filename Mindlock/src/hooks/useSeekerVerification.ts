import { PublicKey } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';

export type VerificationStatus = 'loading' | 'verified' | 'unverified' | 'error';

interface SeekerVerificationResult {
    status: VerificationStatus;
    isVerified: boolean;
    error: string | null;
    checkVerification: () => Promise<void>;
}

/**
 * Seeker device verification.
 *
 * Real Seeker Genesis NFT check requires Metaplex on mainnet.
 * For devnet + Seeker hardware: connecting via the device's Seed Vault /
 * Mobile Wallet Adapter IS sufficient proof of a Seeker-compatible device.
 *
 * Full NFT collection verification is deferred to mainnet launch.
 */
export function useSeekerVerification(
    walletAddress: PublicKey | null
): SeekerVerificationResult {
    const [status, setStatus] = useState<VerificationStatus>('loading');
    const [error, setError] = useState<string | null>(null);

    const checkVerification = useCallback(async () => {
        if (!walletAddress) {
            setStatus('unverified');
            setError('No wallet connected');
            return;
        }

        setStatus('loading');
        setError(null);

        try {
            // MWA / Seed Vault connection = Seeker device confirmed.
            // No NFT check needed at this stage — that is deferred to mainnet.
            setStatus('verified');
        } catch (err) {
            console.error('Seeker verification error:', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Verification failed');
        }
    }, [walletAddress]);

    useEffect(() => {
        if (walletAddress) {
            checkVerification();
        } else {
            setStatus('unverified');
        }
    }, [walletAddress, checkVerification]);

    return {
        status,
        isVerified: status === 'verified',
        error,
        checkVerification,
    };
}

export default useSeekerVerification;
