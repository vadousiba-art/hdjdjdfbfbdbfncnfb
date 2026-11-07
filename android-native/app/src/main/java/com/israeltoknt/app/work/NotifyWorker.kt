package com.israeltoknt.app.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.israeltoknt.app.MainActivity
import com.israeltoknt.app.R
import com.israeltoknt.app.data.Api
import java.util.concurrent.TimeUnit

/**
 * Checks for new messages and activity every 15 minutes (Android's minimum)
 * and shows a notification when something new arrived. No third-party push
 * service is involved; the app asks YORU directly with your session.
 */
class NotifyWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        if (!Api.hasSession()) return Result.success()
        val me = runCatching { Api.me() }.getOrElse { return Result.retry() }
        val prefs = applicationContext.getSharedPreferences("yoru_notify", Context.MODE_PRIVATE)
        val lastMsgs = prefs.getInt("msgs", 0)
        val lastNotes = prefs.getInt("notes", 0)
        if (me.unreadMessages > lastMsgs) {
            show(1, "New messages", "You have ${me.unreadMessages} unread message${if (me.unreadMessages == 1) "" else "s"}.", "/chat")
        }
        if (me.unreadNotifications > lastNotes) {
            show(2, "New activity", "${me.unreadNotifications} new notification${if (me.unreadNotifications == 1) "" else "s"} on YORU.", "/notifications")
        }
        prefs.edit().putInt("msgs", me.unreadMessages).putInt("notes", me.unreadNotifications).apply()
        return Result.success()
    }

    private fun show(id: Int, title: String, text: String, route: String) {
        val ctx = applicationContext
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val open = PendingIntent.getActivity(
            ctx, id, Intent(ctx, MainActivity::class.java).putExtra("route", route).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_yoru)
            .setColor(0xFFF20D2F.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(ctx).notify(id, n) }
    }

    companion object {
        const val CHANNEL = "yoru_activity"

        fun createChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT < 26) return
            val nm = ctx.getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(NotificationChannel(CHANNEL, "Messages and activity", NotificationManager.IMPORTANCE_DEFAULT))
        }

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<NotifyWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("yoru-notify", ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
