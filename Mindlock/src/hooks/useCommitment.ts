import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import {
    commitmentVault,
    CommitmentStatus,
    COMMITMENT_AMOUNT,
    STREAK_DAYS_REQUIRED,
} from '../solana/commitmentVault';

interface UseCommitmentResult {
    status: CommitmentStatus | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    formatTimeRemaining: () => string;
}

/**
 * useCommitment Hook
 * 
 * Fetches and tracks the user's commitment vault status
 */
export function useCommitment(
    walletAddress: PublicKey | null
): UseCommitmentResult {
    const [status, setStatus] = useState<CommitmentStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!walletAddress) {
            setStatus(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const commitmentStatus = await commitmentVault.getCommitmentStatus(walletAddress);
            setStatus(commitmentStatus);
        } catch (err) {
            console.error('Error fetching commitment status:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch commitment');
        } finally {
            setIsLoading(false);
        }
    }, [walletAddress]);

    // Fetch on wallet change
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Auto-refresh every minute
    useEffect(() => {
        if (!walletAddress) return;

        const interval = setInterval(refresh, 60000);
        return () => clearInterval(interval);
    }, [walletAddress, refresh]);

    const formatTimeRemaining = useCallback(() => {
        if (!status) return '';

        if (status.isComplete) {
            return '🎉 Streak complete! Claim your SOL.';
        }

        if (status.isExpired) {
            return '⚠️ Streak expired. Stake will be burned.';
        }

        if (status.canCheckin) {
            return '✅ Ready for daily check-in!';
        }

        const hours = Math.floor(status.hoursUntilNextCheckin);
        const minutes = Math.floor((status.hoursUntilNextCheckin % 1) * 60);

        return `⏳ Next check-in in ${hours}h ${minutes}m`;
    }, [status]);

    return {
        status,
        isLoading,
        error,
        refresh,
        formatTimeRemaining,
    };
}

export default useCommitment;
