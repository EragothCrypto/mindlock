import { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { NETWORK_CONFIG } from '../config/network';
import { mindlockWarden } from '../native/MindlockWarden';

// $SKR Token mint - TODO: replace with real devnet/mainnet SKR token mint
const SKR_TOKEN_MINT = new PublicKey('11111111111111111111111111111111'); // placeholder

// Guardian staking program - TODO: replace once Guardian program is deployed
const GUARDIAN_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // placeholder

export type GuardianCheckStatus = 'idle' | 'checking' | 'delegated' | 'not_delegated' | 'error';

interface GuardianStatusResult {
    status: GuardianCheckStatus;
    isDelegated: boolean;
    gracePeriodMinutes: number;
    error: string | null;
    checkGuardianStatus: () => Promise<void>;
}

/**
 * useGuardianStatus Hook
 * 
 * Checks if the connected wallet has delegated $SKR to a Guardian.
 * Guardian delegators get 45 minute grace period instead of 30 minutes.
 * 
 * This rewards ecosystem participation directly in the Warden's logic.
 */
export function useGuardianStatus(
    walletAddress: PublicKey | null
): GuardianStatusResult {
    const [status, setStatus] = useState<GuardianCheckStatus>('idle');
    const [isDelegated, setIsDelegated] = useState(false);
    const [gracePeriodMinutes, setGracePeriodMinutes] = useState(30);
    const [error, setError] = useState<string | null>(null);

    const checkGuardianStatus = useCallback(async () => {
        if (!walletAddress) {
            setStatus('idle');
            setIsDelegated(false);
            setGracePeriodMinutes(30);
            return;
        }

        setStatus('checking');
        setError(null);

        try {
            const connection = new Connection(NETWORK_CONFIG.rpcUrl, 'confirmed');

            // Check for $SKR token accounts
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                walletAddress,
                { mint: SKR_TOKEN_MINT }
            );

            let hasDelegatedSKR = false;

            // Check if any $SKR is staked/delegated to a Guardian
            // This is a placeholder implementation - real logic would check:
            // 1. If user has $SKR tokens
            // 2. If those tokens are delegated to a Guardian program account
            for (const account of tokenAccounts.value) {
                const parsedInfo = account.account.data.parsed?.info;
                if (parsedInfo?.tokenAmount?.uiAmount > 0) {
                    // Check delegation status
                    // In real implementation, query the Guardian staking program
                    // to see if this wallet has an active delegation

                    // For now, we check if user has SKR and assume delegation
                    // TODO: Implement actual Guardian program delegation check
                    hasDelegatedSKR = true;
                    break;
                }
            }

            // Alternative: Check for Guardian delegation PDA
            // const [delegationPDA] = PublicKey.findProgramAddressSync(
            //   [Buffer.from('delegation'), walletAddress.toBuffer()],
            //   GUARDIAN_PROGRAM_ID
            // );
            // const delegationAccount = await connection.getAccountInfo(delegationPDA);
            // hasDelegatedSKR = delegationAccount !== null;

            // Update native module with Guardian status
            const guardianResult = await mindlockWarden.setGuardianStatus(hasDelegatedSKR);

            setIsDelegated(hasDelegatedSKR);
            setGracePeriodMinutes(guardianResult.gracePeriodMinutes);
            setStatus(hasDelegatedSKR ? 'delegated' : 'not_delegated');

        } catch (err) {
            console.error('Guardian status check error:', err);
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to check Guardian status');

            // Default to non-guardian on error
            setIsDelegated(false);
            setGracePeriodMinutes(30);
        }
    }, [walletAddress]);

    // Check status when wallet changes
    useEffect(() => {
        if (walletAddress) {
            checkGuardianStatus();
        } else {
            setStatus('idle');
            setIsDelegated(false);
            setGracePeriodMinutes(30);
        }
    }, [walletAddress, checkGuardianStatus]);

    return {
        status,
        isDelegated,
        gracePeriodMinutes,
        error,
        checkGuardianStatus,
    };
}

export default useGuardianStatus;
