package com.israeltoknt.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

/**
 * How notifications reach this phone. The server says (GET /api/push/app):
 * "fcm" with Firebase's public app settings once Firebase is set up, so
 * pushes arrive instantly; otherwise "poll", and {@link NotifyWorker} checks
 * in the background. Firebase is started from those settings at runtime, so
 * switching to instant needs no app update.
 */
final class PushSetup {
    static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final String MODE = "push_mode";
    private static final String TOKEN = "fcm_token_sent";
    private static final String CHECKED = "push_checked_at";
    private static final String OPTIONS = "firebase_options";

    private PushSetup() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences("yoru", Context.MODE_PRIVATE);
    }

    /** True when this phone is registered for instant (Firebase) notifications. */
    static boolean instant(Context ctx) {
        SharedPreferences p = prefs(ctx);
        return "fcm".equals(p.getString(MODE, "poll")) && p.getString(TOKEN, null) != null;
    }

    static long checkedAt(Context ctx) {
        return prefs(ctx).getLong(CHECKED, 0);
    }

    static String token(Context ctx) {
        return prefs(ctx).getString(TOKEN, "");
    }

    /** After sign-out: the server row is removed by the page; register again on next sign-in. */
    static void forget(Context ctx) {
        prefs(ctx).edit().remove(TOKEN).putString(MODE, "poll").apply();
    }

    static void refresh(Context ctx) {
        Context app = ctx.getApplicationContext();
        IO.execute(() -> refreshNow(app));
    }

    /** Blocking. */
    static void refreshNow(Context ctx) {
        Net.Response r = Net.call("GET", "/api/push/app", null);
        if (r.status == 401) {
            forget(ctx); // signed out
            return;
        }
        if (!r.ok() || r.data == null) return;
        SharedPreferences p = prefs(ctx);
        p.edit().putLong(CHECKED, System.currentTimeMillis()).apply();
        JSONObject fb = r.data.optJSONObject("firebase");
        if (!"fcm".equals(r.data.optString("mode")) || fb == null) {
            p.edit().putString(MODE, "poll").remove(TOKEN).apply();
            return;
        }
        p.edit().putString(OPTIONS, fb.toString()).apply();
        if (!startFirebase(ctx) || !Notifier.permitted(ctx)) return;
        try {
            FirebaseMessaging.getInstance().getToken()
                    .addOnSuccessListener(IO, token -> register(ctx, token));
        } catch (Exception ignored) {
            // No Google Play services: background checks keep working.
        }
    }

    /** Blocking. Tells YORU where to send this member's pushes. */
    static void register(Context ctx, String token) {
        if (token == null || token.isEmpty()) return;
        try {
            JSONObject body = new JSONObject()
                    .put("token", token)
                    .put("device", trim("YORU app on " + Build.MANUFACTURER + " " + Build.MODEL, 80));
            if (Net.call("POST", "/api/push/app", body).ok()) {
                prefs(ctx).edit().putString(MODE, "fcm").putString(TOKEN, token).apply();
            }
        } catch (Exception ignored) {
            // try again next launch
        }
    }

    /** Starts Firebase from the settings the server sent (if any). */
    static boolean startFirebase(Context ctx) {
        try {
            if (!FirebaseApp.getApps(ctx).isEmpty()) return true;
            String raw = prefs(ctx).getString(OPTIONS, null);
            if (raw == null) return false;
            JSONObject o = new JSONObject(raw);
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(o.getString("appId"))
                    .setApiKey(o.getString("apiKey"))
                    .setProjectId(o.getString("projectId"))
                    .setGcmSenderId(o.getString("senderId"))
                    .build();
            FirebaseApp.initializeApp(ctx, options);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String trim(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
