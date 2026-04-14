import { NativeModules, Platform } from 'react-native';

/**
 * Native module interface — mirrors the Kotlin MindlockWardenModule methods.
 * Typed here so the bridge class below compiles without TS2339 errors.
 */
interface MindlockWardenNative {
    // Permissions
    hasUsageStatsPermission(): Promise<boolean>;
    requestUsageStatsPermission(): Promise<boolean>;
    // Init / Service
    initializeWarden(blockedApps: string[] | null): Promise<{ initialized: boolean; blockedAppsCount: number }>;
    startWardenService(): Promise<{ started: boolean; gracePeriodMinutes: number; isGuardian: boolean }>;
    stopWardenService(): Promise<boolean>;
    // Guardian
    setGuardianStatus(isGuardian: boolean): Promise<{ isGuardian: boolean; gracePeriodMinutes: number }>;
    getGracePeriod(): Promise<{ gracePeriodMinutes: number; isGuardian: boolean; remainingSeconds: number; isExpired: boolean }>;
    // Unlock
    grantTempUnlock(minutes?: number): Promise<{ unlocked: boolean; expiresIn: number }>;
    getUnlockTimeRemaining(): Promise<number>;
    isServiceRunning(): Promise<boolean>;
    // Wallet
    setWalletAddress(address: string): Promise<boolean>;
    // Status
    getStatus(): Promise<{
        isMonitoring: boolean;
        blockedAppsCount: number;
        blockedApps: string[];
        isGuardianDelegator: boolean;
        gracePeriodMinutes: number;
        remainingGraceSeconds: number;
        totalQuizzes: number;
        lastUnlockTimestamp: number;
    }>;
    // Legacy / monitoring
    startMonitoring(): Promise<{ monitoring: boolean; blockedAppsCount: number }>;
    stopMonitoring(): Promise<boolean>;
    isAppBlocked(packageName: string): Promise<boolean>;
    getCurrentForegroundApp(): Promise<any>;
    getBlockedAppsUsage(daysBack: number): Promise<any[]>;
    // Escape action (quiz overlay → lazy unlock / day pass)
    getEscapeAction?(): Promise<string | null>;
}

// Cast with non-null assertion — all call sites are guarded by `isAndroid` checks
const MindlockWarden = NativeModules.MindlockWarden as MindlockWardenNative;

// ========== INTERFACES ==========

export interface AppUsageInfo {
    packageName: string;
    lastTimeUsed: number;
    isBlocked: boolean;
}

export interface AppUsageStats {
    packageName: string;
    totalTimeInForeground: number;
    lastTimeUsed: number;
}

export interface WardenStatus {
    isMonitoring: boolean;
    blockedAppsCount: number;
    blockedApps: string[];
    isGuardianDelegator: boolean;
    gracePeriodMinutes: number;
    remainingGraceSeconds: number;
    totalQuizzes: number;
    lastUnlockTimestamp: number;
}

export interface InitResult {
    initialized: boolean;
    blockedAppsCount: number;
}

export interface ServiceResult {
    started: boolean;
    gracePeriodMinutes: number;
    isGuardian: boolean;
}

export interface GuardianStatus {
    isGuardian: boolean;
    gracePeriodMinutes: number;
}

export interface GracePeriodInfo {
    gracePeriodMinutes: number;
    isGuardian: boolean;
    remainingSeconds: number;
    isExpired: boolean;
}

export interface UnlockResult {
    unlocked: boolean;
    expiresIn: number;
}

// Default Brain-Rot apps to block
export const DEFAULT_BLOCKED_APPS = [
    'com.zhiliaoapp.musically',      // TikTok
    'com.ss.android.ugc.trill',      // TikTok (alternate)
    'com.twitter.android',            // X (Twitter)
    'com.instagram.android',          // Instagram (for Reels)
    'com.facebook.katana',            // Facebook (for Reels)
    'com.reddit.frontpage',           // Reddit
    'com.google.android.youtube',     // YouTube Shorts
];

// Grace periods
export const GRACE_PERIOD_DEFAULT = 30;   // minutes
export const GRACE_PERIOD_GUARDIAN = 45;  // minutes (bonus for $SKR delegators)

/**
 * MindlockWarden Native Module TypeScript Bridge
 * 
 * Controls the Android Warden service that monitors and blocks
 * "Brain-Rot" apps. Supports Guardian delegation bonus (45min grace).
 */
class MindlockWardenBridge {
    private isAndroid = Platform.OS === 'android';

    // ========== PERMISSIONS ==========

    async hasUsageStatsPermission(): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.hasUsageStatsPermission();
    }

    async requestUsageStatsPermission(): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.requestUsageStatsPermission();
    }

    // ========== INITIALIZATION ==========

    async initialize(blockedApps?: string[]): Promise<InitResult> {
        if (!this.isAndroid) {
            return { initialized: false, blockedAppsCount: 0 };
        }
        return MindlockWarden.initializeWarden(blockedApps || null);
    }

    // ========== WARDEN SERVICE CONTROLS ==========

    /**
     * Start the Warden foreground service
     * Begins monitoring for blocked app usage
     */
    async startWardenService(): Promise<ServiceResult> {
        if (!this.isAndroid) {
            return { started: false, gracePeriodMinutes: 30, isGuardian: false };
        }
        return MindlockWarden.startWardenService();
    }

    /**
     * Stop the Warden foreground service
     */
    async stopWardenService(): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.stopWardenService();
    }

    // ========== GUARDIAN DELEGATION ==========

    /**
     * Set Guardian delegation status
     * Guardian delegators ($SKR stakers) get 45min grace instead of 30min
     */
    async setGuardianStatus(isGuardian: boolean): Promise<GuardianStatus> {
        if (!this.isAndroid) {
            return { isGuardian: false, gracePeriodMinutes: 30 };
        }
        return MindlockWarden.setGuardianStatus(isGuardian);
    }

    /**
     * Get current grace period info
     */
    async getGracePeriod(): Promise<GracePeriodInfo> {
        if (!this.isAndroid) {
            return {
                gracePeriodMinutes: 30,
                isGuardian: false,
                remainingSeconds: 0,
                isExpired: true,
            };
        }
        return MindlockWarden.getGracePeriod();
    }

    /**
     * Grant temporary unlock (for testing)
     */
    async grantTempUnlock(): Promise<UnlockResult> {
        if (!this.isAndroid) {
            return { unlocked: false, expiresIn: 0 };
        }
        return MindlockWarden.grantTempUnlock();
    }

    // ========== WALLET ==========

    async setWalletAddress(address: string): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.setWalletAddress(address);
    }

    // ========== STATUS ==========

    async getStatus(): Promise<WardenStatus> {
        if (!this.isAndroid) {
            return {
                isMonitoring: false,
                blockedAppsCount: 0,
                blockedApps: [],
                isGuardianDelegator: false,
                gracePeriodMinutes: 30,
                remainingGraceSeconds: 0,
                totalQuizzes: 0,
                lastUnlockTimestamp: 0,
            };
        }
        return MindlockWarden.getStatus();
    }

    // ========== LEGACY METHODS ==========

    async startMonitoring(): Promise<{ monitoring: boolean; blockedAppsCount: number }> {
        if (!this.isAndroid) {
            return { monitoring: false, blockedAppsCount: 0 };
        }
        return MindlockWarden.startMonitoring();
    }

    async stopMonitoring(): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.stopMonitoring();
    }

    async isAppBlocked(packageName: string): Promise<boolean> {
        if (!this.isAndroid) return false;
        return MindlockWarden.isAppBlocked(packageName);
    }

    async getCurrentForegroundApp(): Promise<AppUsageInfo | null> {
        if (!this.isAndroid) return null;
        return MindlockWarden.getCurrentForegroundApp();
    }

    async getBlockedAppsUsage(daysBack: number = 7): Promise<AppUsageStats[]> {
        if (!this.isAndroid) return [];
        return MindlockWarden.getBlockedAppsUsage(daysBack);
    }
}

export const mindlockWarden = new MindlockWardenBridge();
export default mindlockWarden;
