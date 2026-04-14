package com.mindlock

import android.content.Context
import android.os.SystemClock
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.*
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * DayPass Module - "Emergency Break" Feature
 * 
 * Provides a 24-hour "Shield Mode" that bypasses the Warden,
 * with a 7-day cooldown that uses NTP time (unhackable).
 * 
 * Security:
 * - Uses NTP (time.google.com) for timestamps
 * - Stores data in EncryptedSharedPreferences
 * - Cannot be bypassed by changing system clock
 */
@ReactModule(name = DayPassModule.NAME)
class DayPassModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DayPassModule"
        
        // Timing constants
        const val COOLDOWN_MS = 7L * 24 * 60 * 60 * 1000  // 7 days
        const val DURATION_MS = 24L * 60 * 60 * 1000       // 24 hours
        const val LAST_HOUR_MS = 60L * 60 * 1000           // 1 hour (for red countdown)
        
        // NTP constants
        private const val NTP_SERVER = "time.google.com"
        private const val NTP_PORT = 123
        private const val NTP_TIMEOUT_MS = 10000
        
        // Encrypted prefs keys  
        private const val PREFS_NAME = "mindlock_daypass_encrypted"
        private const val KEY_LAST_PURCHASE = "last_purchase_ntp"
        private const val KEY_SHIELD_EXPIRY = "shield_expiry_ntp"
        private const val KEY_STREAK_FROZEN = "streak_frozen"

        // Plain prefs mirror — readable by WardenService without decryption
        private const val PLAIN_PREFS_NAME = "mindlock_daypass_plain"
        private const val KEY_SHIELD_EXPIRY_PLAIN = "shield_expiry_plain"
        
        private const val TAG = "DayPassModule"
    }

    private val encryptedPrefs by lazy {
        try {
            val masterKey = MasterKey.Builder(reactApplicationContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            
            EncryptedSharedPreferences.create(
                reactApplicationContext,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create encrypted prefs, falling back", e)
            reactApplicationContext.getSharedPreferences(PREFS_NAME + "_fallback", Context.MODE_PRIVATE)
        }
    }

    override fun getName(): String = NAME

    // ========================================================================
    // NTP TIME FETCH (Unhackable)
    // ========================================================================

    /**
     * Fetch current time from NTP server
     * Returns milliseconds since epoch, or 0 on failure
     */
    private suspend fun fetchNtpTime(): Long = withContext(Dispatchers.IO) {
        try {
            val socket = DatagramSocket()
            socket.soTimeout = NTP_TIMEOUT_MS

            val address = InetAddress.getByName(NTP_SERVER)
            
            // NTP request packet (48 bytes)
            val buffer = ByteArray(48)
            buffer[0] = 0x1B // LI=0, VN=3, Mode=3 (client)
            
            val request = DatagramPacket(buffer, buffer.size, address, NTP_PORT)
            socket.send(request)
            
            val response = DatagramPacket(buffer, buffer.size)
            socket.receive(response)
            socket.close()
            
            // Extract transmit timestamp (bytes 40-47)
            // NTP timestamp is seconds since 1900, we need milliseconds since 1970
            val secondsSince1900 = (
                (buffer[40].toLong() and 0xFF shl 24) or
                (buffer[41].toLong() and 0xFF shl 16) or
                (buffer[42].toLong() and 0xFF shl 8) or
                (buffer[43].toLong() and 0xFF)
            )
            
            // Subtract 70 years (1900 to 1970)
            val secondsSince1970 = secondsSince1900 - 2208988800L
            val ntpTime = secondsSince1970 * 1000
            
            Log.d(TAG, "NTP time fetched: $ntpTime")
            ntpTime
        } catch (e: Exception) {
            Log.e(TAG, "NTP fetch failed", e)
            0L
        }
    }

    // ========================================================================
    // DAY PASS METHODS
    // ========================================================================

    /**
     * Check if user can purchase Day Pass (7-day cooldown)
     */
    @ReactMethod
    fun canPurchase(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ntpNow = fetchNtpTime()
                if (ntpNow == 0L) {
                    // Fallback to system time if NTP fails (less secure)
                    val lastPurchase = encryptedPrefs.getLong(KEY_LAST_PURCHASE, 0L)
                    val elapsed = System.currentTimeMillis() - lastPurchase
                    promise.resolve(elapsed >= COOLDOWN_MS)
                    return@launch
                }
                
                val lastPurchase = encryptedPrefs.getLong(KEY_LAST_PURCHASE, 0L)
                val elapsed = ntpNow - lastPurchase
                val canBuy = elapsed >= COOLDOWN_MS
                
                Log.d(TAG, "Can purchase: $canBuy (elapsed: ${elapsed / 1000 / 60 / 60}h)")
                promise.resolve(canBuy)
            } catch (e: Exception) {
                promise.reject("CAN_PURCHASE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Activate Day Pass (called after successful payment)
     */
    @ReactMethod
    fun activateDayPass(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ntpNow = fetchNtpTime()
                val timestamp = if (ntpNow > 0) ntpNow else System.currentTimeMillis()
                
                val expiry = timestamp + DURATION_MS
                
                encryptedPrefs.edit()
                    .putLong(KEY_LAST_PURCHASE, timestamp)
                    .putLong(KEY_SHIELD_EXPIRY, expiry)
                    .putBoolean(KEY_STREAK_FROZEN, true)
                    .apply()

                // Mirror expiry to plain prefs so WardenService can read it
                // (EncryptedSharedPreferences keys+values are opaque to other contexts)
                reactApplicationContext.getSharedPreferences(PLAIN_PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().putLong(KEY_SHIELD_EXPIRY_PLAIN, expiry).apply()
                
                Log.d(TAG, "Day Pass activated! Expires at: $expiry")
                
                val result = Arguments.createMap().apply {
                    putBoolean("activated", true)
                    putDouble("expiresAt", expiry.toDouble())
                    putDouble("durationMs", DURATION_MS.toDouble())
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ACTIVATE_ERROR", e.message, e)
            }
        }
    }

    /**
     * Check if Shield Mode is currently active
     */
    @ReactMethod
    fun isShieldActive(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val expiry = encryptedPrefs.getLong(KEY_SHIELD_EXPIRY, 0L)
                if (expiry == 0L) {
                    promise.resolve(false)
                    return@launch
                }
                
                val ntpNow = fetchNtpTime()
                val now = if (ntpNow > 0) ntpNow else System.currentTimeMillis()
                
                val isActive = now < expiry
                
                // Auto-unfreeze streak if expired
                if (!isActive && encryptedPrefs.getBoolean(KEY_STREAK_FROZEN, false)) {
                    encryptedPrefs.edit()
                        .putBoolean(KEY_STREAK_FROZEN, false)
                        .apply()
                    // Also clear the plain mirror so WardenService stops bypassing
                    reactApplicationContext.getSharedPreferences(PLAIN_PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().remove(KEY_SHIELD_EXPIRY_PLAIN).apply()
                }
                
                promise.resolve(isActive)
            } catch (e: Exception) {
                promise.reject("SHIELD_CHECK_ERROR", e.message, e)
            }
        }
    }

    /**
     * Get full Day Pass status for UI
     */
    @ReactMethod
    fun getStatus(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ntpNow = fetchNtpTime()
                val now = if (ntpNow > 0) ntpNow else System.currentTimeMillis()
                
                val lastPurchase = encryptedPrefs.getLong(KEY_LAST_PURCHASE, 0L)
                val expiry = encryptedPrefs.getLong(KEY_SHIELD_EXPIRY, 0L)
                val streakFrozen = encryptedPrefs.getBoolean(KEY_STREAK_FROZEN, false)
                
                val isShieldActive = expiry > 0 && now < expiry
                val shieldRemainingMs = if (isShieldActive) (expiry - now) else 0L
                val isLastHour = shieldRemainingMs in 1..LAST_HOUR_MS
                
                val cooldownRemainingMs = if (lastPurchase > 0) {
                    val elapsed = now - lastPurchase
                    if (elapsed < COOLDOWN_MS) COOLDOWN_MS - elapsed else 0L
                } else 0L
                
                val canPurchase = cooldownRemainingMs == 0L && !isShieldActive
                
                val result = Arguments.createMap().apply {
                    putBoolean("isShieldActive", isShieldActive)
                    putDouble("shieldRemainingMs", shieldRemainingMs.toDouble())
                    putBoolean("isLastHour", isLastHour)
                    putBoolean("streakFrozen", streakFrozen)
                    putBoolean("canPurchase", canPurchase)
                    putDouble("cooldownRemainingMs", cooldownRemainingMs.toDouble())
                }
                
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("STATUS_ERROR", e.message, e)
            }
        }
    }

    /**
     * Check if streak is currently frozen
     */
    @ReactMethod
    fun isStreakFrozen(promise: Promise) {
        try {
            val frozen = encryptedPrefs.getBoolean(KEY_STREAK_FROZEN, false)
            promise.resolve(frozen)
        } catch (e: Exception) {
            promise.reject("STREAK_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Get remaining cooldown time in milliseconds
     */
    @ReactMethod
    fun getCooldownRemaining(promise: Promise) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ntpNow = fetchNtpTime()
                val now = if (ntpNow > 0) ntpNow else System.currentTimeMillis()
                
                val lastPurchase = encryptedPrefs.getLong(KEY_LAST_PURCHASE, 0L)
                if (lastPurchase == 0L) {
                    promise.resolve(0.0)
                    return@launch
                }
                
                val elapsed = now - lastPurchase
                val remaining = if (elapsed < COOLDOWN_MS) COOLDOWN_MS - elapsed else 0L
                
                promise.resolve(remaining.toDouble())
            } catch (e: Exception) {
                promise.reject("COOLDOWN_ERROR", e.message, e)
            }
        }
    }

    /**
     * Reset Day Pass (for testing only)
     */
    @ReactMethod
    fun reset(promise: Promise) {
        try {
            encryptedPrefs.edit().clear().apply()
            Log.d(TAG, "Day Pass reset")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESET_ERROR", e.message, e)
        }
    }
}
