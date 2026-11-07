package com.israeltoknt.app;

import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.json.JSONObject;

/**
 * window.YoruApp: what the page can ask the app for. Notifications go through
 * the phone (the WebView has no Web Push), and Atlas reads replies aloud with
 * the phone's own voice (the WebView has no speechSynthesis). Results arrive
 * on the page as `yoru-app` events. Only YORU's own pages may use it.
 */
final class AppBridge {
    private final MainActivity act;
    private TextToSpeech tts;
    private boolean ttsReady;
    private Runnable afterTtsReady;

    AppBridge(MainActivity act) {
        this.act = act;
    }

    @JavascriptInterface
    public String version() {
        return BuildConfig.VERSION_NAME;
    }

    /** "granted", "default" (can ask) or "denied" (only Settings can change it). */
    @JavascriptInterface
    public String notificationState() {
        return act.trusted ? act.notificationState() : "denied";
    }

    /** "instant" (Firebase) or "background" (checked every ~15 minutes). */
    @JavascriptInterface
    public String pushMode() {
        return PushSetup.instant(act) ? "instant" : "background";
    }

    @JavascriptInterface
    public void requestNotifications() {
        if (act.trusted) act.runOnUiThread(act::askNotifications);
    }

    @JavascriptInterface
    public void openNotificationSettings() {
        if (act.trusted) act.runOnUiThread(act::openNotificationSettings);
    }

    @JavascriptInterface
    public boolean testNotification() {
        if (!act.trusted || !Notifier.permitted(act)) return false;
        Notifier.Item n = new Notifier.Item();
        n.title = act.getString(R.string.test_title);
        n.body = act.getString(R.string.test_body);
        n.url = BuildConfig.APP_URL + "/notifications";
        n.tag = "test";
        PushSetup.IO.execute(() -> Notifier.show(act.getApplicationContext(), n));
        return true;
    }

    /** Once per visit while signed in: make sure pushes for this phone go to whoever is signed in now. */
    @JavascriptInterface
    public void syncPush() {
        if (act.trusted) PushSetup.refresh(act);
    }

    /** The Firebase token, so the page can unregister it before signing out. */
    @JavascriptInterface
    public String pushToken() {
        return act.trusted ? PushSetup.token(act) : "";
    }

    @JavascriptInterface
    public void forgetPush() {
        if (act.trusted) PushSetup.forget(act);
    }

    // ------------------------------------------------------------ speech

    @JavascriptInterface
    public boolean canSpeak() {
        return true;
    }

    @JavascriptInterface
    public void speak(String text, String lang, float rate, String id) {
        if (!act.trusted || text == null) return;
        act.runOnUiThread(() -> withTts(() -> {
            tts.stop();
            Locale locale = lang == null || lang.isEmpty() ? Locale.getDefault() : Locale.forLanguageTag(lang);
            if (tts.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(locale);
            tts.setSpeechRate(rate > 0.2f && rate < 3f ? rate : 1f);
            List<String> parts = chunks(text, Math.min(3900, TextToSpeech.getMaxSpeechInputLength()));
            for (int i = 0; i < parts.size(); i++) {
                String uid = id + (i == parts.size() - 1 ? "#last" : "#" + i);
                tts.speak(parts.get(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, uid);
            }
        }));
    }

    @JavascriptInterface
    public void stopSpeaking() {
        act.runOnUiThread(() -> {
            if (tts != null) tts.stop();
        });
    }

    private void withTts(Runnable r) {
        if (tts != null && ttsReady) {
            r.run();
            return;
        }
        afterTtsReady = r;
        if (tts != null) return;
        tts = new TextToSpeech(act, status -> act.runOnUiThread(() -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            Runnable next = afterTtsReady;
            afterTtsReady = null;
            if (ttsReady && next != null) next.run();
            else if (!ttsReady) emitSpeech("error", "");
        }));
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String uid) {
                emitSpeech("start", base(uid));
            }

            @Override
            public void onDone(String uid) {
                if (uid.endsWith("#last")) emitSpeech("end", base(uid));
            }

            @Override
            public void onStop(String uid, boolean interrupted) {
                emitSpeech("end", base(uid));
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String uid) {
                emitSpeech("error", base(uid));
            }
        });
    }

    private static String base(String uid) {
        int i = uid.lastIndexOf('#');
        return i < 0 ? uid : uid.substring(0, i);
    }

    private void emitSpeech(String state, String id) {
        try {
            act.emit(new JSONObject().put("type", "speech").put("state", state).put("id", id));
        } catch (Exception ignored) {
            // can't happen
        }
    }

    /** Splits long text at sentence ends so each piece fits the engine's limit. */
    private static List<String> chunks(String text, int max) {
        List<String> out = new ArrayList<>();
        String rest = text.trim();
        while (rest.length() > max) {
            int cut = Math.max(rest.lastIndexOf(". ", max), Math.max(rest.lastIndexOf("\n", max), rest.lastIndexOf("! ", max)));
            if (cut < max / 2) cut = rest.lastIndexOf(' ', max);
            if (cut <= 0) cut = max;
            out.add(rest.substring(0, cut + 1).trim());
            rest = rest.substring(cut + 1).trim();
        }
        if (!rest.isEmpty()) out.add(rest);
        return out;
    }

    void destroy() {
        if (tts != null) tts.shutdown();
        tts = null;
    }
}
