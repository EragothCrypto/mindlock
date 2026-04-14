package com.mindlock

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

/**
 * MindlockWarden Native Module
 * 
 * Handles Android UsageStatsManager integration for app monitoring and blocking.
 * This module allows Mindlock to track and restrict access to "Brain-Rot" apps
 * until the user proves Solana ecosystem knowledge.
 */
@ReactModule(name = MindlockWardenModule.NAME)
class MindlockWardenModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "MindlockWarden"
        
        // List of default "Brain-Rot" apps to monitor
        val DEFAULT_BLOCKED_APPS = listOf(
            "com.zhiliaoapp.musically",      // TikTok
            "com.ss.android.ugc.trill",      // TikTok (alternate)
            "com.twitter.android",            // X (Twitter)
            "com.instagram.android",          // Instagram (for Reels)
            "com.facebook.katana",            // Facebook (for Reels)
            "com.reddit.frontpage",           // Reddit
            "com.google.android.youtube"      // YouTube Shorts
        )
    }

    private var isMonitoring = false
    private var blockedApps: List<String> = emptyList()

    override fun getName(): String = NAME

    /**
     * Check if the app has usage stats permission
     */
    @ReactMethod
    fun hasUsageStatsPermission(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactApplicationContext.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactApplicationContext.packageName
                )
            }
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Request usage stats permission by opening system settings
     */
    @ReactMethod
    fun requestUsageStatsPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PERMISSION_REQUEST_ERROR", e.message, e)
        }
    }

    /**
     * Initialize the warden with optional custom blocked apps list
     */
    @ReactMethod
    fun initializeWarden(blockedAppsArray: ReadableArray?, promise: Promise) {
        try {
            blockedApps = if (blockedAppsArray != null && blockedAppsArray.size() > 0) {
                (0 until blockedAppsArray.size()).map { blockedAppsArray.getString(it) ?: "" }
                    .filter { it.isNotEmpty() }
            } else {
                DEFAULT_BLOCKED_APPS
            }

            // CRITICAL: Persist to WardenPreferences so WardenService can access the list
            // WardenService runs in a separate context and reads from SharedPreferences
            val prefs = WardenPreferences(reactApplicationContext)
            prefs.blockedApps = blockedApps.toSet()

            promise.resolve(WritableNativeMap().apply {
                putBoolean("initialized", true)
                putInt("blockedAppsCount", blockedApps.size)
            })
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", e.message, e)
        }
    }

    /**
     * Start monitoring app usage
     */
    @ReactMethod
    fun startMonitoring(promise: Promise) {
        try {
            isMonitoring = true
            promise.resolve(WritableNativeMap().apply {
                putBoolean("monitoring", true)
                putInt("blockedAppsCount", blockedApps.size)
            })
        } catch (e: Exception) {
            promise.reject("MONITORING_ERROR", e.message, e)
        }
    }


    /**
     * Stop monitoring app usage
     */
    @ReactMethod
    fun stopMonitoring(promise: Promise) {
        try {
            isMonitoring = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    /**
     * Check if a specific app is in the blocked list
     */
    @ReactMethod
    fun isAppBlocked(packageName: String, promise: Promise) {
        promise.resolve(blockedApps.contains(packageName))
    }

    /**
     * Get the currently foreground app (requires usage stats permission)
     */
    @ReactMethod
    fun getCurrentForegroundApp(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            val endTime = System.currentTimeMillis()
            val beginTime = endTime - 1000 * 60 // Last minute
            
            val usageStats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                beginTime,
                endTime
            )
            
            if (usageStats.isNullOrEmpty()) {
                promise.resolve(null)
                return
            }
            
            // Find the most recently used app
            val recentApp = usageStats
                .filter { it.lastTimeUsed > 0 }
                .maxByOrNull { it.lastTimeUsed }
            
            if (recentApp != null) {
                promise.resolve(WritableNativeMap().apply {
                    putString("packageName", recentApp.packageName)
                    putDouble("lastTimeUsed", recentApp.lastTimeUsed.toDouble())
                    putBoolean("isBlocked", blockedApps.contains(recentApp.packageName))
                })
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Get usage stats for blocked apps
     */
    @ReactMethod
    fun getBlockedAppsUsage(daysBack: Int, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            
            val endTime = System.currentTimeMillis()
            val beginTime = endTime - (1000L * 60 * 60 * 24 * daysBack)
            
            val usageStats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                beginTime,
                endTime
            )
            
            val blockedAppsUsage = WritableNativeArray()
            
            usageStats
                .filter { blockedApps.contains(it.packageName) }
                .forEach { stats ->
                    blockedAppsUsage.pushMap(WritableNativeMap().apply {
                        putString("packageName", stats.packageName)
                        putDouble("totalTimeInForeground", stats.totalTimeInForeground.toDouble())
                        putDouble("lastTimeUsed", stats.lastTimeUsed.toDouble())
                    })
                }
            
            promise.resolve(blockedAppsUsage)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Get the current monitoring status
     */
    @ReactMethod
    fun getStatus(promise: Promise) {
        val prefs = WardenPreferences(reactApplicationContext)
        promise.resolve(WritableNativeMap().apply {
            putBoolean("isMonitoring", isMonitoring)
            putInt("blockedAppsCount", blockedApps.size)
            putArray("blockedApps", WritableNativeArray().apply {
                blockedApps.forEach { pushString(it) }
            })
            putBoolean("isGuardianDelegator", prefs.isGuardianDelegator)
            putInt("gracePeriodMinutes", prefs.gracePeriodMinutes)
            putDouble("remainingGraceSeconds", prefs.getRemainingGraceSeconds().toDouble())
            putInt("totalQuizzes", prefs.totalQuizzes)
            putDouble("lastUnlockTimestamp", prefs.lastUnlockTimestamp.toDouble())
        })
    }

    /**
     * Read and clear the escape action from the MainActivity intent.
     * Called by App.tsx on AppState.active to route to lazy_unlock or day_pass.
     */
    @ReactMethod
    fun getEscapeAction(promise: Promise) {
        try {
            val activity = reactApplicationContext.currentActivity
            val action = activity?.intent?.getStringExtra(
                MindlockQuizActivity.EXTRA_ESCAPE_ACTION
            )
            // Clear it so it only triggers once
            activity?.intent?.removeExtra(MindlockQuizActivity.EXTRA_ESCAPE_ACTION)
            promise.resolve(action)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    /**
     * Grant the configured grace period to the user.
     * Called after a confirmed Lazy Unlock payment.
     * Records the unlock timestamp so WardenService allows app access.
     */
    @ReactMethod
    fun grantGracePeriod(promise: Promise) {
        try {
            val prefs = WardenPreferences(reactApplicationContext)
            prefs.recordUnlock()           // stamps lastUnlockTimestamp = now
            promise.resolve(WritableNativeMap().apply {
                putBoolean("granted", true)
                putInt("gracePeriodMinutes", prefs.gracePeriodMinutes)
                putDouble("remainingGraceSeconds", prefs.getRemainingGraceSeconds().toDouble())
            })
        } catch (e: Exception) {
            promise.reject("GRACE_ERROR", e.message, e)
        }
    }

    // ========== WARDEN SERVICE CONTROLS ==========

    /**
     * Start the Warden foreground service
     */
    @ReactMethod
    fun startWardenService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, WardenService::class.java).apply {
                action = WardenService.ACTION_START
            }
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            
            isMonitoring = true
            val prefs = WardenPreferences(reactApplicationContext)
            
            promise.resolve(WritableNativeMap().apply {
                putBoolean("started", true)
                putInt("gracePeriodMinutes", prefs.gracePeriodMinutes)
                putBoolean("isGuardian", prefs.isGuardianDelegator)
            })
        } catch (e: Exception) {
            promise.reject("SERVICE_START_ERROR", e.message, e)
        }
    }

    /**
     * Stop the Warden foreground service
     */
    @ReactMethod
    fun stopWardenService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, WardenService::class.java).apply {
                action = WardenService.ACTION_STOP
            }
            reactApplicationContext.startService(intent)
            isMonitoring = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SERVICE_STOP_ERROR", e.message, e)
        }
    }

    // ========== GUARDIAN DELEGATION ==========

    /**
     * Set Guardian delegation status
     * Guardian delegators get 45 min grace period instead of 30
     */
    @ReactMethod
    fun setGuardianStatus(isGuardian: Boolean, promise: Promise) {
        try {
            val prefs = WardenPreferences(reactApplicationContext)
            prefs.isGuardianDelegator = isGuardian
            
            promise.resolve(WritableNativeMap().apply {
                putBoolean("isGuardian", isGuardian)
                putInt("gracePeriodMinutes", prefs.gracePeriodMinutes)
            })
        } catch (e: Exception) {
            promise.reject("GUARDIAN_STATUS_ERROR", e.message, e)
        }
    }

    /**
     * Get current grace period info
     */
    @ReactMethod
    fun getGracePeriod(promise: Promise) {
        try {
            val prefs = WardenPreferences(reactApplicationContext)
            promise.resolve(WritableNativeMap().apply {
                putInt("gracePeriodMinutes", prefs.gracePeriodMinutes)
                putBoolean("isGuardian", prefs.isGuardianDelegator)
                putDouble("remainingSeconds", prefs.getRemainingGraceSeconds().toDouble())
                putBoolean("isExpired", prefs.isGracePeriodExpired())
            })
        } catch (e: Exception) {
            promise.reject("GRACE_PERIOD_ERROR", e.message, e)
        }
    }

    /**
     * Grant temporary unlock (for testing)
     */
    @ReactMethod
    fun grantTempUnlock(promise: Promise) {
        try {
            val prefs = WardenPreferences(reactApplicationContext)
            prefs.recordUnlock()
            
            promise.resolve(WritableNativeMap().apply {
                putBoolean("unlocked", true)
                putDouble("expiresIn", prefs.getRemainingGraceSeconds().toDouble())
            })
        } catch (e: Exception) {
            promise.reject("UNLOCK_ERROR", e.message, e)
        }
    }

    /**
     * Set the connected wallet address
     */
    @ReactMethod
    fun setWalletAddress(address: String, promise: Promise) {
        try {
            val prefs = WardenPreferences(reactApplicationContext)
            prefs.walletAddress = address
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WALLET_ERROR", e.message, e)
        }
    }

    // ========== APP PICKER METHODS ==========

    /**
     * Get list of installed user apps (for app picker).
     *
     * Two-pass approach:
     * 1. Collect all packages that resolve a LAUNCHER intent — these are apps
     *    the user can open from the home screen (no system services, no background
     *    components like Accessibility Suite or Play Services infrastructure).
     * 2. Union with brain-rot allowlist so TikTok appears even on ROMs that
     *    ship it without a launcher icon (com.zhiliaoapp.musically, etc.).
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager

            // Pass 1: apps with a LAUNCHER-category intent (truly user-visible)
            val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val launcherApps = pm.queryIntentActivities(launcherIntent, 0)
            val launcherPackages = launcherApps.map { it.activityInfo.packageName }.toMutableSet()

            // Pass 2: add brain-rot apps even if they have no launcher (some TikTok ROMs)
            val brainRotPackages = listOf(
                "com.zhiliaoapp.musically",
                "com.ss.android.ugc.trill",
                "com.instagram.android",
                "com.twitter.android",
                "com.google.android.youtube",
                "com.reddit.frontpage",
                "com.snapchat.android",
                "com.facebook.katana",
                "com.facebook.lite",
            )
            brainRotPackages.forEach { pkg ->
                try {
                    pm.getApplicationInfo(pkg, 0)
                    launcherPackages.add(pkg) // only add if actually installed
                } catch (_: Exception) { /* not installed, skip */ }
            }

            // Remove our own app
            launcherPackages.remove(reactApplicationContext.packageName)

            val result = WritableNativeArray()
            launcherPackages.forEach { packageName ->
                val appInfo = try {
                    pm.getApplicationInfo(packageName, 0)
                } catch (_: Exception) { return@forEach }

                val appName = try {
                    pm.getApplicationLabel(appInfo).toString()
                } catch (_: Exception) {
                    packageName
                }

                result.pushMap(WritableNativeMap().apply {
                    putString("packageName", packageName)
                    putString("appName", appName)
                })
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message, e)
        }
    }

    /**
     * Set blocked apps list - called from AppPickerScreen when user saves their selection.
     * Persists to WardenPreferences so WardenService polling loop can read them.
     */
    @ReactMethod
    fun setBlockedApps(apps: ReadableArray, promise: Promise) {
        try {
            blockedApps = (0 until apps.size()).mapNotNull { apps.getString(it) }

            // Persist to WardenPreferences (mindlock_warden_prefs) — what WardenService reads
            val wardenPrefs = WardenPreferences(reactApplicationContext)
            wardenPrefs.blockedApps = blockedApps.toSet()

            promise.resolve(WritableNativeMap().apply {
                putBoolean("success", true)
                putInt("count", blockedApps.size)
            })
        } catch (e: Exception) {
            promise.reject("SET_BLOCKED_ERROR", e.message, e)
        }
    }

    /**
     * Get blocked apps count
     */
    @ReactMethod
    fun getBlockedAppsCount(promise: Promise) {
        promise.resolve(blockedApps.size)
    }
}
