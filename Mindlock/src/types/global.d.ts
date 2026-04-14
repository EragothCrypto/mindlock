/**
 * Global type declarations for Mindlock
 */

/// <reference types="node" />
import { Buffer as BufferType } from 'buffer';

// Extend NodeJS global interface for Buffer polyfill
declare global {
    // eslint-disable-next-line no-var
    var Buffer: typeof BufferType;
}

// MindlockWarden native module interfaces
interface InitResult {
    initialized: boolean;
    blockedAppsCount: number;
}

interface ServiceResult {
    started: boolean;
    gracePeriodMinutes: number;
    isGuardian: boolean;
}

interface GuardianStatus {
    isGuardian: boolean;
    gracePeriodMinutes: number;
}

interface GracePeriodInfo {
    gracePeriodMinutes: number;
    isGuardian: boolean;
    remainingSeconds: number;
    isExpired: boolean;
}

interface UnlockResult {
    unlocked: boolean;
    expiresIn: number;
}

interface WardenStatus {
    isMonitoring: boolean;
    blockedAppsCount: number;
    blockedApps: string[];
    isGuardianDelegator: boolean;
    gracePeriodMinutes: number;
    remainingGraceSeconds: number;
}

interface AppUsageInfo {
    packageName: string;
    lastTimeUsed: number;
    isBlocked: boolean;
}

interface AppUsageStats {
    packageName: string;
    totalTimeInForeground: number;
    lastTimeUsed: number;
}

// Additional interfaces for app picker
interface InstalledAppInfo {
    packageName: string;
    appName: string;
}

interface SetBlockedResult {
    success: boolean;
    count: number;
}

// NativeModules type declarations
declare module 'react-native' {
    interface NativeModulesStatic {
        MindlockWarden: {
            // Permissions
            hasUsageStatsPermission(): Promise<boolean>;
            requestUsageStatsPermission(): Promise<boolean>;
            // Initialization
            initializeWarden(blockedApps: string[] | null): Promise<InitResult>;
            // Service controls
            startWardenService(): Promise<ServiceResult>;
            stopWardenService(): Promise<boolean>;
            // Guardian/Delegation
            setGuardianStatus(isGuardian: boolean): Promise<GuardianStatus>;
            getGracePeriod(): Promise<GracePeriodInfo>;
            grantTempUnlock(): Promise<UnlockResult>;
            // Wallet
            setWalletAddress(address: string): Promise<boolean>;
            // Status
            getStatus(): Promise<WardenStatus>;
            // App Picker
            getInstalledApps(): Promise<InstalledAppInfo[]>;
            setBlockedApps(apps: string[]): Promise<SetBlockedResult>;
            getBlockedAppsCount(): Promise<number>;
            // Legacy methods
            startMonitoring(): Promise<{ monitoring: boolean; blockedAppsCount: number }>;
            stopMonitoring(): Promise<boolean>;
            isAppBlocked(packageName: string): Promise<boolean>;
            getCurrentForegroundApp(): Promise<AppUsageInfo | null>;
            getBlockedAppsUsage(daysBack: number): Promise<AppUsageStats[]>;
        };
    }
}

export { };
