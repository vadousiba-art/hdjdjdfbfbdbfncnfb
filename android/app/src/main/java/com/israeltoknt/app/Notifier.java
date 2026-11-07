package com.israeltoknt.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** YORU's notifications in the phone's notification shade. */
final class Notifier {
    static final String MESSAGES = "yoru_messages";
    static final String ACTIVITY = "yoru_activity";
    private static final int BRAND = Color.parseColor("#F20D2F");

    static final class Item {
        String title;
        String body;
        String url;
        String tag;
        String icon;
        int unread;
        boolean urgent;
    }

    private Notifier() {}

    /** Two channels, so people can mute activity but keep messages (or the other way round). */
    static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel messages = new NotificationChannel(MESSAGES, ctx.getString(R.string.channel_messages), NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription(ctx.getString(R.string.channel_messages_body));
        NotificationChannel activity = new NotificationChannel(ACTIVITY, ctx.getString(R.string.channel_activity), NotificationManager.IMPORTANCE_DEFAULT);
        activity.setDescription(ctx.getString(R.string.channel_activity_body));
        for (NotificationChannel ch : new NotificationChannel[] {messages, activity}) {
            ch.enableLights(true);
            ch.setLightColor(BRAND);
            ch.setShowBadge(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        }
        nm.createNotificationChannel(messages);
        nm.createNotificationChannel(activity);
    }

    static boolean permitted(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33
                && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    /** Shows (or replaces, by tag) a notification. Loads the sender's photo, so call off the main thread. */
    static boolean show(Context ctx, Item item) {
        if (!permitted(ctx)) return false;
        String tag = item.tag == null || item.tag.isEmpty() ? "yoru" : item.tag;
        Intent open = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra(MainActivity.EXTRA_URL, item.url)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, tag.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, item.urgent ? MESSAGES : ACTIVITY)
                .setSmallIcon(R.drawable.ic_stat_yoru)
                .setColor(BRAND)
                .setContentTitle(item.title)
                .setContentText(item.body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(item.body))
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setCategory(item.urgent ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_SOCIAL)
                .setPriority(item.urgent ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setDefaults(NotificationCompat.DEFAULT_ALL);
        if (item.unread > 0) b.setNumber(item.unread);
        Bitmap face = avatar(item.icon);
        if (face != null) b.setLargeIcon(face);
        try {
            NotificationManagerCompat.from(ctx).notify(tag, 0, b.build());
            return true;
        } catch (SecurityException e) {
            return false;
        }
    }

    /** The sender's photo, round. YORU's own mark is skipped (the small icon already shows it). */
    private static Bitmap avatar(String url) {
        if (url == null || !url.startsWith("https://") || url.contains("/brand/yoru/")) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(4000);
            c.setReadTimeout(4000);
            Bitmap src;
            try (InputStream in = c.getInputStream()) {
                BitmapFactory.Options o = new BitmapFactory.Options();
                o.inSampleSize = 2;
                src = BitmapFactory.decodeStream(in, null, o);
            }
            if (src == null) return null;
            int size = Math.min(256, Math.min(src.getWidth(), src.getHeight()));
            Bitmap square = Bitmap.createScaledBitmap(src, size, size, true);
            Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new BitmapShader(square, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            new Canvas(out).drawCircle(size / 2f, size / 2f, size / 2f, p);
            return out;
        } catch (Exception | OutOfMemoryError e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
