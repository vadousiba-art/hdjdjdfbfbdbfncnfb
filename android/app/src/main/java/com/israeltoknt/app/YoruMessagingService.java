package com.israeltoknt.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Instant notifications (Firebase). While YORU is in the background Android
 * shows them itself; this handles the rest and keeps the token up to date.
 */
public class YoruMessagingService extends FirebaseMessagingService {
    @Override
    public void onNewToken(@NonNull String token) {
        if (Notifier.permitted(this)) PushSetup.register(this, token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        if (MainActivity.visible) return; // YORU is open: the page shows it live
        Map<String, String> data = msg.getData();
        RemoteMessage.Notification shown = msg.getNotification();
        Notifier.Item n = new Notifier.Item();
        n.title = shown != null && shown.getTitle() != null ? shown.getTitle() : data.getOrDefault("title", "YORU");
        n.body = shown != null && shown.getBody() != null ? shown.getBody() : data.getOrDefault("body", "");
        n.url = data.getOrDefault("url", BuildConfig.APP_URL + "/notifications");
        n.tag = data.getOrDefault("tag", msg.getMessageId());
        n.icon = shown != null && shown.getImageUrl() != null ? shown.getImageUrl().toString() : null;
        try {
            n.unread = Integer.parseInt(data.getOrDefault("unread", "0"));
        } catch (NumberFormatException e) {
            n.unread = 0;
        }
        n.urgent = shown != null && Notifier.MESSAGES.equals(shown.getChannelId());
        Notifier.show(this, n);
    }
}
