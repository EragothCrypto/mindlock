// Mindlock Network Configuration
// Defaults to devnet for hackathon demo with faucet SOL.
//
// ─── Quicknode (Eitherway Side Track) ────────────────────────────────────────
// Set QUICKNODE_DEVNET_URL and QUICKNODE_DEVNET_WS_URL in your .env file
// to route all RPC traffic through Quicknode for:
//   • Unlimited getProgramAccounts (rate-limited on public RPC)
//   • <40ms median latency vs ~200ms on api.devnet.solana.com
//   • Quicknode Streams → real-time leaderboard updates
//   • Qualifies Mindlock for the Eitherway/Quicknode side track
//
// Get a free endpoint at: https://www.quicknode.com/
// See .env.example for variable names.
// ─────────────────────────────────────────────────────────────────────────────

export type NetworkType = 'devnet' | 'testnet' | 'mainnet-beta';

interface NetworkConfig {
    network: NetworkType;
    rpcUrl: string;
    wsUrl: string;
    explorerUrl: string;
    /** True when using a Quicknode endpoint (shown in DX report / Quicknode side track) */
    isQuicknode: boolean;
}

// ─── Quicknode endpoints (resolved from env at startup) ───────────────────
// @ts-ignore — injected by react-native-dotenv / babel-plugin-transform-inline-env
const QN_HTTP: string = process.env.QUICKNODE_DEVNET_URL ?? '';
// @ts-ignore
const QN_WS: string   = process.env.QUICKNODE_DEVNET_WS_URL ?? '';
// @ts-ignore
const QN_MAINNET_HTTP: string = process.env.QUICKNODE_MAINNET_URL ?? '';
// @ts-ignore
const QN_MAINNET_WS: string   = process.env.QUICKNODE_MAINNET_WS_URL ?? '';

const PUBLIC_DEVNET_HTTP = 'https://api.devnet.solana.com';
const PUBLIC_DEVNET_WS   = 'wss://api.devnet.solana.com';

// ─── Network configurations ───────────────────────────────────────────────
const NETWORKS: Record<NetworkType, NetworkConfig> = {
    devnet: {
        network: 'devnet',
        // Prefer Quicknode if configured; fall back to public endpoint
        rpcUrl: QN_HTTP || PUBLIC_DEVNET_HTTP,
        wsUrl:  QN_WS   || PUBLIC_DEVNET_WS,
        explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
        isQuicknode: Boolean(QN_HTTP),
    },
    testnet: {
        network: 'testnet',
        rpcUrl: 'https://api.testnet.solana.com',
        wsUrl:  'wss://api.testnet.solana.com',
        explorerUrl: 'https://explorer.solana.com/?cluster=testnet',
        isQuicknode: false,
    },
    'mainnet-beta': {
        network: 'mainnet-beta',
        rpcUrl: QN_MAINNET_HTTP || 'https://api.mainnet-beta.solana.com',
        wsUrl:  QN_MAINNET_WS   || 'wss://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
        isQuicknode: Boolean(QN_MAINNET_HTTP),
    },
};

// ─── Active network ────────────────────────────────────────────────────────
const getNetworkFromEnv = (): NetworkType => {
    // @ts-ignore
    const envNetwork = process.env.SOLANA_NETWORK;
    if (envNetwork && envNetwork in NETWORKS) {
        return envNetwork as NetworkType;
    }
    return 'devnet';
};

export const NETWORK_CONFIG = NETWORKS[getNetworkFromEnv()];

// Log RPC provider on startup (useful for judges verifying Quicknode usage)
if (__DEV__) {
    const provider = NETWORK_CONFIG.isQuicknode ? '⚡ Quicknode' : '🌐 Public RPC';
    console.log(`[Mindlock] RPC: ${provider} → ${NETWORK_CONFIG.rpcUrl}`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export const getExplorerTxUrl = (signature: string): string => {
    const cluster = NETWORK_CONFIG.network === 'mainnet-beta' ? '' : `?cluster=${NETWORK_CONFIG.network}`;
    return `https://explorer.solana.com/tx/${signature}${cluster}`;
};

export const getExplorerAddressUrl = (address: string): string => {
    const cluster = NETWORK_CONFIG.network === 'mainnet-beta' ? '' : `?cluster=${NETWORK_CONFIG.network}`;
    return `https://explorer.solana.com/address/${address}${cluster}`;
};

export const FAUCET_URL = 'https://faucet.solana.com/';

/** App Authority — signs daily check-ins (prevents user self-signing) */
export const APP_AUTHORITY_PUBKEY = '6c4rjMrm6jq1hAgboXdBxj31HHNqXGG1r2DwFpXwyAUd';

export default NETWORK_CONFIG;
