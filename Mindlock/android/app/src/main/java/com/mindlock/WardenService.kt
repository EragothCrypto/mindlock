package com.mindlock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * WardenService - Foreground Service for App Monitoring
 * 
 * Polls UsageStatsManager every 2 seconds to detect when user opens
 * a blacklisted "Brain-Rot" app. If grace period has expired,
 * launches the MindlockQuizActivity as a full-screen overlay.
 * 
 * Grace Periods:
 * - Default: 30 minutes
 * - Guardian Delegator: 45 minutes (rewards $SKR staking)
 */
class WardenService : Service() {

    companion object {
        private const val TAG = "WardenService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "mindlock_warden_channel"
        private const val CHANNEL_NAME = "Mindlock Warden"
        private const val POLL_INTERVAL_MS = 2000L // 2 seconds
        
        // Intent actions
        const val ACTION_START = "com.mindlock.action.START_WARDEN"
        const val ACTION_STOP = "com.mindlock.action.STOP_WARDEN"
    }

    private lateinit var prefs: WardenPreferences
    private lateinit var handler: Handler
    private var isRunning = false
    private var lastBlockedPackage: String? = null

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (isRunning) {
                checkForegroundApp()
                handler.postDelayed(this, POLL_INTERVAL_MS)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = WardenPreferences(this)
        handler = Handler(Looper.getMainLooper())
        createNotificationChannel()
        Log.d(TAG, "WardenService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopWarden()
                return START_NOT_STICKY
            }
            else -> {
                startWarden()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopWarden()
        super.onDestroy()
        Log.d(TAG, "WardenService destroyed")
    }

    private fun startWarden() {
        if (isRunning) return
        
        isRunning = true
        startForeground(NOTIFICATION_ID, createNotification())
        handler.post(pollRunnable)
        
        Log.d(TAG, "Warden started - Grace period: ${prefs.gracePeriodMinutes} minutes")
    }

    private fun stopWarden() {
        isRunning = false
        handler.removeCallbacks(pollRunnable)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        
        Log.d(TAG, "Warden stopped")
    }

    /**
     * Check the currently foreground app and trigger quiz if needed
     */
    private fun checkForegroundApp() {
        val foregroundPackage = getForegroundPackage() ?: return
        
        // Skip if it's our own app
        if (foregroundPackage == packageName) return
        
        // Check if app is in blocklist
        if (!prefs.isAppBlocked(foregroundPackage)) {
            lastBlockedPackage = null
            return
        }

        // ── Day Pass shield check ───────────────────────────────────────────
        // DayPassModule writes a plain-prefs mirror on activateDayPass() so we
        // can read it here without instantiating EncryptedSharedPreferences.
        val dayPassPrefs = getSharedPreferences("mindlock_daypass_plain", Context.MODE_PRIVATE)
        val shieldExpiry = dayPassPrefs.getLong("shield_expiry_plain", 0L)
        if (shieldExpiry > 0L && System.currentTimeMillis() < shieldExpiry) {
            val remainingMins = (shieldExpiry - System.currentTimeMillis()) / 60000
            Log.d(TAG, "Day Pass shield active — $remainingMins min remaining, allowing: $foregroundPackage")
            lastBlockedPackage = null // reset so quiz fires when shield expires
            return
        }
        // ───────────────────────────────────────────────────────────────────

        // Check if quiz grace period is still active
        if (!prefs.isGracePeriodExpired()) {
            val remaining = prefs.getRemainingGraceSeconds()
            Log.d(TAG, "Blocked app detected but grace active: $remaining seconds remaining")
            return
        }
        
        // Prevent launching quiz multiple times for same app
        if (foregroundPackage == lastBlockedPackage) {
            return
        }
        
        Log.d(TAG, "Blocked app detected, grace expired - launching quiz for: $foregroundPackage")
        lastBlockedPackage = foregroundPackage
        launchQuizActivity(foregroundPackage)
    }

    /**
     * Get the currently foreground app package name
     */
    private fun getForegroundPackage(): String? {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            ?: return null
        
        val endTime = System.currentTimeMillis()
        val beginTime = endTime - 10000 // Last 10 seconds
        
        val usageStats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            beginTime,
            endTime
        )
        
        if (usageStats.isNullOrEmpty()) return null
        
        // Find most recently used app
        return usageStats
            .filter { it.lastTimeUsed > 0 }
            .maxByOrNull { it.lastTimeUsed }
            ?.packageName
    }

    /**
     * Launch the quiz activity as an overlay
     */
    private fun launchQuizActivity(blockedPackage: String) {
        val intent = Intent(this, MindlockQuizActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(MindlockQuizActivity.EXTRA_BLOCKED_PACKAGE, blockedPackage)
        }
        startActivity(intent)
    }

    /**
     * Create the foreground notification
     */
    private fun createNotification(): Notification {
        val stopIntent = Intent(this, WardenService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val graceText = if (prefs.isGuardianDelegator) {
            "Guardian Mode: ${prefs.gracePeriodMinutes}min grace"
        } else {
            "Standard Mode: ${prefs.gracePeriodMinutes}min grace"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🔒 Mindlock Active")
            .setContentText(graceText)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Stop Warden",
                stopPendingIntent
            )
            .build()
    }

    /**
     * Create notification channel for Android 8+
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notification for Mindlock Warden background service"
                setShowBadge(false)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
