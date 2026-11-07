package com.israeltoknt.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Until Firebase is set up: every 15 minutes (Android's shortest background
 * interval; it may wait longer to save battery) the app asks YORU for new
 * notifications and puts them in the notification shade.
 */
public class NotifyWorker extends Worker {
    private static final String SINCE = "poll_since";
    private static final String SEEN = "poll_seen";

    public NotifyWorker(@NonNull Context ctx, @NonNull WorkerParameters params) {
        super(ctx, params);
    }

    static void schedule(Context ctx) {
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NotifyWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("yoru-notifications", ExistingPeriodicWorkPolicy.KEEP, req);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        // Once a day, see whether instant notifications were switched on or off.
        if (System.currentTimeMillis() - PushSetup.checkedAt(ctx) > TimeUnit.DAYS.toMillis(1)) PushSetup.refreshNow(ctx);
        if (PushSetup.instant(ctx) || MainActivity.visible || !Notifier.permitted(ctx)) return Result.success();

        SharedPreferences p = PushSetup.prefs(ctx);
        String since = p.getString(SINCE, "");
        Net.Response r = Net.call("GET", "/api/push/app/pending?since=" + android.net.Uri.encode(since), null);
        if (!r.ok() || r.data == null) return Result.success(); // signed out or offline: next round

        List<String> seen = new ArrayList<>(Arrays.asList(p.getString(SEEN, "").split(",")));
        JSONArray items = r.data.optJSONArray("items");
        if (items != null) {
            // Oldest first, so the newest ends up on top of the shade.
            for (int i = items.length() - 1; i >= 0; i--) {
                JSONObject it = items.optJSONObject(i);
                if (it == null || seen.contains(it.optString("id"))) continue;
                Notifier.Item n = new Notifier.Item();
                n.title = it.optString("title", "YORU");
                n.body = it.optString("body", "");
                n.url = it.optString("url", BuildConfig.APP_URL + "/notifications");
                n.tag = it.optString("tag", it.optString("id"));
                n.icon = it.optString("icon", null);
                n.unread = r.data.optInt("unread", 0);
                n.urgent = it.optBoolean("urgent", false);
                if (Notifier.show(ctx, n)) seen.add(it.optString("id"));
            }
        }
        while (seen.size() > 60) seen.remove(0);
        String newest = r.data.optString("newest", "");
        SharedPreferences.Editor e = p.edit().putString(SEEN, String.join(",", seen));
        if (!newest.isEmpty() && !"null".equals(newest)) e.putString(SINCE, newest);
        e.apply();
        return Result.success();
    }
}
