package com.mindlock

import android.content.Context
import android.content.SharedPreferences

/**
 * WardenPreferences - SharedPreferences wrapper for Mindlock Warden
 * 
 * Stores:
 * - Last unlock timestamp
 * - Blocked apps list
 * - Guardian delegation status (for grace period bonus)
 * - Grace period duration
 */
class WardenPreferences(context: Context) {

    companion object {
        private const val PREFS_NAME = "mindlock_warden_prefs"
        private const val KEY_LAST_UNLOCK = "last_unlock_timestamp"
        private const val KEY_BLOCKED_APPS = "blocked_apps"
        private const val KEY_IS_GUARDIAN = "is_guardian_delegator"
        private const val KEY_WALLET_ADDRESS = "wallet_address"
        private const val KEY_TOTAL_QUIZZES = "total_quizzes_passed"

        // Grace periods in minutes
        const val DEFAULT_GRACE_PERIOD = 30
        const val GUARDIAN_GRACE_PERIOD = 45
    }

    private val prefs: SharedPreferences = 
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Last time the user successfully passed a quiz
     */
    var lastUnlockTimestamp: Long
        get() = prefs.getLong(KEY_LAST_UNLOCK, 0L)
        set(value) { prefs.edit().putLong(KEY_LAST_UNLOCK, value).apply() }

    /**
     * Set of blocked app package names
     */
    var blockedApps: Set<String>
        get() = prefs.getStringSet(KEY_BLOCKED_APPS, DEFAULT_BLOCKED_APPS) ?: DEFAULT_BLOCKED_APPS
        set(value) { prefs.edit().putStringSet(KEY_BLOCKED_APPS, value).apply() }

    /**
     * Whether user has delegated $SKR to a Guardian
     * Grants 45min grace period instead of 30min
     */
    var isGuardianDelegator: Boolean
        get() = prefs.getBoolean(KEY_IS_GUARDIAN, false)
        set(value) { prefs.edit().putBoolean(KEY_IS_GUARDIAN, value).apply() }

    /**
     * Connected wallet address
     */
    var walletAddress: String?
        get() = prefs.getString(KEY_WALLET_ADDRESS, null)
        set(value) { prefs.edit().putString(KEY_WALLET_ADDRESS, value).apply() }

    /**
     * Current grace period in minutes based on Guardian status
     */
    val gracePeriodMinutes: Int
        get() = if (isGuardianDelegator) GUARDIAN_GRACE_PERIOD else DEFAULT_GRACE_PERIOD

    /**
     * Grace period in milliseconds
     */
    val gracePeriodMs: Long
        get() = gracePeriodMinutes * 60 * 1000L

    /**
     * Check if grace period has expired
     */
    fun isGracePeriodExpired(): Boolean {
        val elapsed = System.currentTimeMillis() - lastUnlockTimestamp
        return elapsed > gracePeriodMs
    }

    /**
     * Get remaining grace period in seconds
     */
    fun getRemainingGraceSeconds(): Long {
        val elapsed = System.currentTimeMillis() - lastUnlockTimestamp
        val remaining = gracePeriodMs - elapsed
        return if (remaining > 0) remaining / 1000 else 0
    }

    /**
     * Update unlock timestamp to now
     */
    fun recordUnlock() {
        lastUnlockTimestamp = System.currentTimeMillis()
    }

    /**
     * Total number of quizzes passed (for dashboard stats)
     */
    var totalQuizzes: Int
        get() = prefs.getInt(KEY_TOTAL_QUIZZES, 0)
        set(value) { prefs.edit().putInt(KEY_TOTAL_QUIZZES, value).apply() }

    /**
     * Increment quiz pass count
     */
    fun incrementQuizCount() {
        totalQuizzes = totalQuizzes + 1
    }

    /**
     * Check if an app is in the blocked list
     */
    fun isAppBlocked(packageName: String): Boolean {
        return blockedApps.contains(packageName)
    }

    /**
     * Clear all preferences (for testing/reset)
     */
    fun clear() {
        prefs.edit().clear().apply()
    }

    /**
     * Default blocked apps - "Brain-Rot" apps
     */
    private val DEFAULT_BLOCKED_APPS = setOf(
        "com.zhiliaoapp.musically",      // TikTok
        "com.ss.android.ugc.trill",      // TikTok (alternate)
        "com.twitter.android",            // X (Twitter)
        "com.instagram.android",          // Instagram (for Reels)
        "com.facebook.katana",            // Facebook (for Reels)
        "com.reddit.frontpage",           // Reddit
        "com.google.android.youtube"      // YouTube Shorts
    )
}
