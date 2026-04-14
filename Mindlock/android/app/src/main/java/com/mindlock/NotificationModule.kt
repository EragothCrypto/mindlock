package com.mindlock

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.util.Calendar

/**
 * NotificationModule — Local Scheduled Notifications
 *
 * Handles:
 *  - Daily streak reminders ("Day X at risk! Prove your focus.")
 *  - Epoch ending soon alerts (24h and 1h before epoch end)
 *  - Immediate "well done" notifications after quiz pass
 *
 * Uses Android AlarmManager — no Firebase, no extra npm packages.
 */
@ReactModule(name = NotificationModule.NAME)
class NotificationModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NotificationModule"
        private const val TAG = "NotificationModule"

        // Notification channels
        const val CHANNEL_STREAK = "mindlock_streak"
        const val CHANNEL_EPOCH = "mindlock_epoch"
        const val CHANNEL_REWARD = "mindlock_reward"

        // Notification IDs
        const val NOTIF_STREAK_DAILY = 2001
        const val NOTIF_EPOCH_24H   = 2002
        const val NOTIF_EPOCH_1H    = 2003
        const val NOTIF_QUIZ_PASS   = 2004

        // AlarmManager request codes
        const val REQ_STREAK_DAILY  = 3001
    }

    override fun getName(): String = NAME

    // =========================================================================
    // CHANNEL SETUP
    // =========================================================================

    @ReactMethod
    fun createChannels(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = reactApplicationContext
                    .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

                nm.createNotificationChannel(NotificationChannel(
                    CHANNEL_STREAK, "Streak Reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply { description = "Daily reminders to protect your quiz streak" })

                nm.createNotificationChannel(NotificationChannel(
                    CHANNEL_EPOCH, "Epoch Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply { description = "Alerts when the reward epoch is ending soon" })

                nm.createNotificationChannel(NotificationChannel(
                    CHANNEL_REWARD, "Quiz & Rewards",
                    NotificationManager.IMPORTANCE_LOW
                ).apply { description = "Quiz completion and reward notifications" })
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHANNEL_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // STREAK REMINDER — Scheduled daily at a given hour
    // =========================================================================

    /**
     * Schedule a daily streak reminder.
     * @param hourOfDay 24h hour to fire (e.g. 20 = 8 PM)
     * @param currentStreak the streak count to include in the message
     */
    @ReactMethod
    fun scheduleStreakReminder(hourOfDay: Int, currentStreak: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, StreakReminderReceiver::class.java).apply {
                putExtra("streak", currentStreak)
            }
            val pi = PendingIntent.getBroadcast(
                context, REQ_STREAK_DAILY, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Fire today at hourOfDay; if already past, fire tomorrow
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, hourOfDay)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1)
            }

            alarmManager.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                cal.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pi
            )
            Log.d(TAG, "Streak reminder scheduled for ${cal.time}")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    /** Cancel the daily streak reminder */
    @ReactMethod
    fun cancelStreakReminder(promise: Promise) {
        try {
            val context = reactApplicationContext
            val pi = PendingIntent.getBroadcast(
                context, REQ_STREAK_DAILY,
                Intent(context, StreakReminderReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            pi?.let {
                (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(it)
                it.cancel()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // EPOCH ALERT — One-shot at given timestamp
    // =========================================================================

    /**
     * Schedule a one-shot epoch ending alert.
     * @param epochEndMs epoch end time in milliseconds (Unix)
     * @param hoursBeforeEnd 24 or 1
     */
    @ReactMethod
    fun scheduleEpochAlert(epochEndMs: Double, hoursBeforeEnd: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val fireAt = epochEndMs.toLong() - (hoursBeforeEnd * 60 * 60 * 1000L)
            if (fireAt <= System.currentTimeMillis()) {
                promise.resolve(false) // already past
                return
            }

            val reqCode = if (hoursBeforeEnd == 24) 3002 else 3003
            val intent = Intent(context, EpochAlertReceiver::class.java).apply {
                putExtra("hours_before", hoursBeforeEnd)
                putExtra("epoch_end_ms", epochEndMs.toLong())
            }
            val pi = PendingIntent.getBroadcast(
                context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, fireAt, pi)
            }
            Log.d(TAG, "Epoch alert scheduled: $hoursBeforeEnd h before end")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EPOCH_ERROR", e.message, e)
        }
    }

    // =========================================================================
    // IMMEDIATE NOTIFICATIONS
    // =========================================================================

    /** Show an immediate "Well done!" notification after a quiz pass */
    @ReactMethod
    fun showQuizPassNotification(streakDays: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
            val pi = PendingIntent.getActivity(
                context, 0, launchIntent,
                PendingIntent.FLAG_IMMUTABLE
            )

            val streak = if (streakDays > 1) " 🔥 Day $streakDays streak!" else ""
            val notif = NotificationCompat.Builder(context, CHANNEL_REWARD)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("✅ Quiz Passed!")
                .setContentText("Grace period granted.$streak")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build()

            nm.notify(NOTIF_QUIZ_PASS, notif)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_ERROR", e.message, e)
        }
    }
}

// =============================================================================
// BROADCAST RECEIVERS
// =============================================================================

/** Fires the daily streak reminder notification */
class StreakReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val streak = intent.getIntExtra("streak", 0)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pi = PendingIntent.getActivity(
            context, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE
        )

        val (title, body) = when {
            streak >= 7  -> "🔥 Day $streak streak at risk!" to "Open Mindlock and pass today's quiz to keep it alive."
            streak >= 3  -> "⚡ Keep the streak going!" to "Day $streak — don't break your focus now. Quiz up!"
            streak == 0  -> "🔒 Start your streak today" to "Pass a quiz now to begin your productivity journey."
            else         -> "🔒 Daily focus reminder" to "You've got a $streak-day streak! Don't lose it today."
        }

        val notif = NotificationCompat.Builder(context, NotificationModule.CHANNEL_STREAK)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        nm.notify(NotificationModule.NOTIF_STREAK_DAILY, notif)
        Log.d("StreakReminder", "Streak reminder fired. Streak=$streak")
    }
}

/** Fires the epoch ending alert notification */
class EpochAlertReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val hoursBefore = intent.getIntExtra("hours_before", 24)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pi = PendingIntent.getActivity(
            context, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE
        )

        val skr = "\$SKR"
        val (title, body) = if (hoursBefore == 1)
            "⏰ 1 hour left this epoch!" to "Final chance to boost your Focus Score and claim $skr rewards before the epoch closes!"
        else
            "📅 Epoch ends in 24 hours" to "Make sure you pass today's quiz to maximize your leaderboard ranking and $skr reward share."

        val notif = NotificationCompat.Builder(context, NotificationModule.CHANNEL_EPOCH)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        nm.notify(
            if (hoursBefore == 1) NotificationModule.NOTIF_EPOCH_1H else NotificationModule.NOTIF_EPOCH_24H,
            notif
        )
        Log.d("EpochAlert", "Epoch alert fired. HoursBefore=$hoursBefore")
    }
}
