/**
 * Storage Utility
 * 
 * Wrapper around AsyncStorage for app data persistence.
 * Provides synchronous-like API through caching for critical hot paths.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
export const STORAGE_KEYS = {
    HAS_SEEN_TUTORIAL: 'hasSeenTutorial',
    BLOCKED_APPS: 'blockedApps',
    WALLET_ADDRESS: 'walletAddress',
    USER_STATS: 'userStats',
    LAST_UNLOCK_TIME: 'lastUnlockTime',
    PERMISSION_GRANTED: 'permissionGranted',
    WARDEN_ACTIVATED: 'wardenActivated',
    SETUP_STEP: 'setupStep',
} as const;

// In-memory cache for synchronous access
let cachedBlockedApps: string[] = [];
let cachedTutorialSeen = false;
let cachedPermissionGranted = false;
let cachedWardenActivated = false;
let cachedSetupStep = 1;
let cacheInitialized = false;

/**
 * Initialize cache from storage (call on app start)
 */
export async function initializeStorage(): Promise<void> {
    try {
        const [blockedAppsRaw, tutorialSeen, permissionGranted, wardenActivated, setupStep] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.BLOCKED_APPS),
            AsyncStorage.getItem(STORAGE_KEYS.HAS_SEEN_TUTORIAL),
            AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_GRANTED),
            AsyncStorage.getItem(STORAGE_KEYS.WARDEN_ACTIVATED),
            AsyncStorage.getItem(STORAGE_KEYS.SETUP_STEP),
        ]);

        cachedBlockedApps = blockedAppsRaw ? JSON.parse(blockedAppsRaw) : [];
        cachedTutorialSeen = tutorialSeen === 'true';
        cachedPermissionGranted = permissionGranted === 'true';
        cachedWardenActivated = wardenActivated === 'true';
        cachedSetupStep = setupStep ? parseInt(setupStep, 10) : 1;
        cacheInitialized = true;
    } catch (error) {
        console.error('Storage init error:', error);
        cacheInitialized = true;
    }
}

/**
 * Get blocked apps list (synchronous from cache)
 */
export function getBlockedApps(): string[] {
    return cachedBlockedApps;
}

/**
 * Set blocked apps list
 */
export function setBlockedApps(apps: string[]): void {
    cachedBlockedApps = apps;
    AsyncStorage.setItem(STORAGE_KEYS.BLOCKED_APPS, JSON.stringify(apps));
}

/**
 * Add an app to blocked list
 */
export function addBlockedApp(packageName: string): void {
    if (!cachedBlockedApps.includes(packageName)) {
        cachedBlockedApps.push(packageName);
        setBlockedApps(cachedBlockedApps);
    }
}

/**
 * Remove an app from blocked list
 */
export function removeBlockedApp(packageName: string): void {
    cachedBlockedApps = cachedBlockedApps.filter(app => app !== packageName);
    setBlockedApps(cachedBlockedApps);
}

/**
 * Check if tutorial has been seen (synchronous from cache)
 */
export function hasSeenTutorial(): boolean {
    return cachedTutorialSeen;
}

/**
 * Mark tutorial as seen
 */
export function setTutorialSeen(): void {
    cachedTutorialSeen = true;
    AsyncStorage.setItem(STORAGE_KEYS.HAS_SEEN_TUTORIAL, 'true');
}

/**
 * Check if permissions have been granted (synchronous from cache)
 */
export function hasPermissionsGranted(): boolean {
    return cachedPermissionGranted;
}

/**
 * Mark permissions as granted
 */
export function setPermissionsGranted(granted: boolean): void {
    cachedPermissionGranted = granted;
    AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_GRANTED, granted.toString());
}

/**
 * Store user stats for leaderboard
 */
export async function setUserStats(stats: { accuracy: number; streak: number; unlocks: number }): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(stats));
}

/**
 * Get user stats
 */
export async function getUserStats(): Promise<{ accuracy: number; streak: number; unlocks: number } | null> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_STATS);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Check if warden has been activated
 */
export function hasWardenActivated(): boolean {
    return cachedWardenActivated;
}

/**
 * Mark warden as activated
 */
export function setWardenActivated(activated: boolean): void {
    cachedWardenActivated = activated;
    AsyncStorage.setItem(STORAGE_KEYS.WARDEN_ACTIVATED, activated.toString());
}

/**
 * Get the last setup step reached
 */
export function getSavedSetupStep(): number {
    return cachedSetupStep;
}

/**
 * Save current setup step
 */
export function saveSetupStep(step: number): void {
    cachedSetupStep = step;
    AsyncStorage.setItem(STORAGE_KEYS.SETUP_STEP, step.toString());
}

/**
 * Check if storage cache is initialized
 */
export function isStorageReady(): boolean {
    return cacheInitialized;
}
