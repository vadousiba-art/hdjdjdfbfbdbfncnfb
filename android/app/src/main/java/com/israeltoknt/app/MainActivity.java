package com.israeltoknt.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.json.JSONObject;

/**
 * YORU for Android: the live web app in a full-screen WebView. The app owns
 * the phone permissions: it asks once on first launch (notifications,
 * microphone, camera; each can be allowed or not), then lets YORU's pages use
 * the microphone and camera without the browser-style prompt, and shows
 * notifications in the notification shade.
 */
public class MainActivity extends Activity {
    static final String EXTRA_URL = "url";
    static volatile boolean visible;

    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int REQ_WELCOME = 2001;
    private static final int REQ_MEDIA = 2002;
    private static final int REQ_NOTIFY = 2003;
    private static final int REQ_CHOOSER_CAMERA = 2004;
    private static final String OFFLINE_PAGE = "file:///android_asset/offline.html";
    private static final String LEGACY_HOST = "israeltoknt.vercel.app";
    private static final String FILES = "com.yoru.social.fileprovider";

    private WebView webView;
    private View welcome;
    private AppBridge bridge;
    private String appHost;
    /** The page on screen is YORU's own (not the offline page). */
    volatile boolean trusted;
    private boolean pageReady;
    private boolean pushChecked;

    private ValueCallback<Uri[]> pendingUpload;
    private WebChromeClient.FileChooserParams pendingChooser;
    private File cameraPhoto;
    private File cameraVideo;
    private PermissionRequest pendingMedia;
    private String[] pendingMediaResources;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appHost = Uri.parse(BuildConfig.APP_URL).getHost();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#080808"));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#080808"));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        applyInsets(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // muted feed videos autoplay like the web
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() + " YORU-App/" + BuildConfig.VERSION_NAME
                + " IsraelTokntAndroid/" + BuildConfig.VERSION_NAME);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        bridge = new AppBridge(this);
        webView.addJavascriptInterface(bridge, "YoruApp");
        webView.setWebViewClient(new ShellClient());
        webView.setWebChromeClient(new ShellChrome());
        webView.setDownloadListener((url, ua, disposition, mime, length) -> openOutside(Uri.parse(url)));

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(startUrl(getIntent()));
        }
        if (!prefs().getBoolean("welcomed", false)) showWelcome(root);
        cleanCameraFiles();
    }

    private SharedPreferences prefs() {
        return PushSetup.prefs(this);
    }

    // ------------------------------------------------------------------ first launch

    private void showWelcome(FrameLayout root) {
        welcome = LayoutInflater.from(this).inflate(R.layout.welcome, root, false);
        root.addView(welcome);
        welcome.setAlpha(0f);
        welcome.animate().alpha(1f).setDuration(250).start();
        View mark = welcome.findViewById(R.id.welcome_mark);
        mark.setScaleX(0.9f);
        mark.setScaleY(0.9f);
        mark.animate().scaleX(1f).scaleY(1f).setDuration(600).start();
        welcome.findViewById(R.id.welcome_allow).setOnClickListener(v -> {
            String[] missing = missing(welcomePermissions());
            if (missing.length == 0) finishWelcome();
            else ask(missing, REQ_WELCOME);
        });
        welcome.findViewById(R.id.welcome_skip).setOnClickListener(v -> finishWelcome());
    }

    private String[] welcomePermissions() {
        List<String> p = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 33) p.add(Manifest.permission.POST_NOTIFICATIONS);
        p.add(Manifest.permission.RECORD_AUDIO);
        p.add(Manifest.permission.CAMERA);
        return p.toArray(new String[0]);
    }

    private void finishWelcome() {
        prefs().edit().putBoolean("welcomed", true).apply();
        View w = welcome;
        welcome = null;
        if (w != null) {
            w.animate().alpha(0f).setDuration(220).withEndAction(() -> ((ViewGroup) w.getParent()).removeView(w)).start();
        }
        PushSetup.refresh(this);
        emitNotificationState();
    }

    // ------------------------------------------------------------------ permissions

    private boolean granted(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private String[] missing(String[] permissions) {
        List<String> out = new ArrayList<>();
        for (String p : permissions) if (!granted(p)) out.add(p);
        return out.toArray(new String[0]);
    }

    /** Android won't show its dialog again ("Don't allow" twice, or turned off in Settings). */
    private boolean blocked(String permission) {
        return !granted(permission) && prefs().getBoolean("asked_" + permission, false)
                && !shouldShowRequestPermissionRationale(permission);
    }

    private void ask(String[] permissions, int code) {
        SharedPreferences.Editor e = prefs().edit();
        for (String p : permissions) e.putBoolean("asked_" + p, true);
        e.apply();
        requestPermissions(permissions, code);
    }

    String notificationState() {
        if (Notifier.permitted(this)) return "granted";
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)
                && !blocked(Manifest.permission.POST_NOTIFICATIONS)) return "default";
        return "denied";
    }

    void askNotifications() {
        String state = notificationState();
        if ("granted".equals(state)) {
            emitNotificationState();
        } else if ("default".equals(state) && Build.VERSION.SDK_INT >= 33) {
            ask(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
        } else {
            openNotificationSettings();
        }
    }

    void openNotificationSettings() {
        Intent i = Build.VERSION.SDK_INT >= 26
                ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null));
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            openAppSettings();
        }
    }

    private void openAppSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getPackageName(), null)));
        } catch (ActivityNotFoundException ignored) {
            // nothing to open
        }
    }

    /** Microphone or camera is blocked: offer the app's settings page. */
    private void explainBlocked(String permission) {
        String name = Manifest.permission.CAMERA.equals(permission) ? getString(R.string.perm_camera) : getString(R.string.perm_mic);
        new AlertDialog.Builder(this, R.style.Dialog)
                .setTitle(getString(R.string.blocked_title, name))
                .setMessage(getString(R.string.blocked_body, name.toLowerCase(Locale.getDefault())))
                .setPositiveButton(R.string.open_settings, (d, w) -> openAppSettings())
                .setNegativeButton(R.string.cancel, null)
                .show();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == REQ_WELCOME) {
            finishWelcome();
        } else if (code == REQ_NOTIFY) {
            emitNotificationState();
            if (Notifier.permitted(this)) PushSetup.refresh(this);
        } else if (code == REQ_MEDIA) {
            answerMedia();
        } else if (code == REQ_CHOOSER_CAMERA && pendingChooser != null) {
            WebChromeClient.FileChooserParams params = pendingChooser;
            pendingChooser = null;
            openChooser(params);
        }
    }

    /** Grants a YORU page what it asked for (microphone/camera) that Android allows. */
    private void answerMedia() {
        PermissionRequest req = pendingMedia;
        String[] resources = pendingMediaResources;
        pendingMedia = null;
        pendingMediaResources = null;
        if (req == null) return;
        List<String> ok = new ArrayList<>();
        for (String r : resources) if (granted(permissionFor(r))) ok.add(r);
        if (ok.isEmpty()) req.deny();
        else req.grant(ok.toArray(new String[0]));
    }

    private static String permissionFor(String resource) {
        return PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) ? Manifest.permission.CAMERA : Manifest.permission.RECORD_AUDIO;
    }

    // ------------------------------------------------------------------ page <-> app

    /** Sends a `yoru-app` event to the page. */
    void emit(JSONObject detail) {
        runOnUiThread(() -> {
            if (webView != null && trusted) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('yoru-app',{detail:" + detail + "}))", null);
            }
        });
    }

    private void emitNotificationState() {
        if (!pageReady) return;
        try {
            emit(new JSONObject().put("type", "notifications").put("state", notificationState())
                    .put("mode", PushSetup.instant(this) ? "instant" : "background"));
        } catch (Exception ignored) {
            // can't happen
        }
    }

    // ------------------------------------------------------------------ navigation

    /** A notification tap, a YORU link, or the home page. */
    private String startUrl(Intent intent) {
        String fromNotification = intent != null ? intent.getStringExtra(EXTRA_URL) : null;
        if (fromNotification != null) {
            Uri u = Uri.parse(fromNotification);
            if (isAppUrl(u)) return fromNotification;
            if (fromNotification.startsWith("/") && !fromNotification.startsWith("//")) return BuildConfig.APP_URL + fromNotification;
        }
        Uri data = intent != null ? intent.getData() : null;
        if (data != null && appHost.equals(data.getHost()) && "https".equals(data.getScheme())) {
            return data.toString();
        }
        // Links to the pre-YORU address open the same page on the current one.
        if (data != null && LEGACY_HOST.equals(data.getHost()) && "https".equals(data.getScheme())) {
            return data.buildUpon().authority(appHost).build().toString();
        }
        return BuildConfig.APP_URL;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.getData() != null || intent.getStringExtra(EXTRA_URL) != null) webView.loadUrl(startUrl(intent));
    }

    /** Keep content clear of the status bar, navigation bar and keyboard (edge-to-edge on Android 15+). */
    private void applyInsets(View root) {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsAppearance(0, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            getWindow().setStatusBarColor(Color.parseColor("#080808"));
            getWindow().setNavigationBarColor(Color.parseColor("#080808"));
        }
    }

    private void handleBack() {
        if (welcome != null) {
            finishWelcome();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    /** Before Android 13 (newer versions use the callback registered in onCreate). */
    @Override
    @SuppressWarnings("deprecation")
    @SuppressLint("GestureBackNavigation")
    public void onBackPressed() {
        handleBack();
    }

    private boolean isAppUrl(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && appHost.equals(uri.getHost());
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // nothing can open it
        }
    }

    private class ShellClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAppUrl(uri)) return false;
            if ("file".equals(uri.getScheme())) return false;
            // Everything else (external links, mailto:, etc.) opens outside the app.
            openOutside(uri);
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            trusted = isAppUrl(Uri.parse(url));
            pageReady = false;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                view.loadUrl(OFFLINE_PAGE + "?u=" + Uri.encode(BuildConfig.APP_URL));
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            CookieManager.getInstance().flush();
            trusted = isAppUrl(Uri.parse(url));
            pageReady = trusted;
            if (trusted && !pushChecked && welcome == null) {
                pushChecked = true;
                PushSetup.refresh(MainActivity.this);
            }
        }
    }

    private class ShellChrome extends WebChromeClient {
        /** A YORU page wants the microphone or camera (e.g. talking to Atlas). */
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                if (!isAppUrl(request.getOrigin())) {
                    request.deny();
                    return;
                }
                List<String> wanted = new ArrayList<>();
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wanted.add(r);
                }
                if (wanted.isEmpty()) {
                    request.deny();
                    return;
                }
                List<String> need = new ArrayList<>();
                for (String r : wanted) {
                    String p = permissionFor(r);
                    if (!granted(p) && !need.contains(p)) need.add(p);
                }
                if (need.isEmpty()) {
                    request.grant(wanted.toArray(new String[0]));
                    return;
                }
                List<String> askable = new ArrayList<>();
                for (String p : need) if (!blocked(p)) askable.add(p);
                if (pendingMedia != null) pendingMedia.deny();
                pendingMedia = request;
                pendingMediaResources = wanted.toArray(new String[0]);
                if (askable.isEmpty()) {
                    answerMedia();
                    explainBlocked(need.get(0));
                } else {
                    ask(askable.toArray(new String[0]), REQ_MEDIA);
                }
            });
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (request == pendingMedia) {
                pendingMedia = null;
                pendingMediaResources = null;
            }
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingUpload != null) pendingUpload.onReceiveValue(null);
            pendingUpload = callback;
            if (!granted(Manifest.permission.CAMERA) && !blocked(Manifest.permission.CAMERA)
                    && hasCameraApp() && wants(params, "image", "video")) {
                // Ask for the camera first so "take a photo" can be offered.
                pendingChooser = params;
                ask(new String[] {Manifest.permission.CAMERA}, REQ_CHOOSER_CAMERA);
                return true;
            }
            return openChooser(params);
        }
    }

    // ------------------------------------------------------------------ attachments

    private boolean hasCameraApp() {
        return new Intent(MediaStore.ACTION_IMAGE_CAPTURE).resolveActivity(getPackageManager()) != null;
    }

    private static boolean wants(WebChromeClient.FileChooserParams params, String... kinds) {
        String[] accept = params.getAcceptTypes();
        String all = accept == null ? "" : String.join(",", accept).toLowerCase(Locale.ROOT).trim();
        if (all.isEmpty() || all.contains("*/*")) return true;
        for (String k : kinds) if (all.contains(k)) return true;
        return false;
    }

    /** The phone's picker, plus "take a photo/video" when the camera is allowed. */
    private boolean openChooser(WebChromeClient.FileChooserParams params) {
        Intent pick = params.createIntent();
        if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        List<Intent> capture = new ArrayList<>();
        cameraPhoto = null;
        cameraVideo = null;
        if (granted(Manifest.permission.CAMERA)) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException();
                long now = System.currentTimeMillis();
                if (wants(params, "image")) {
                    cameraPhoto = new File(dir, "photo-" + now + ".jpg");
                    capture.add(captureIntent(MediaStore.ACTION_IMAGE_CAPTURE, cameraPhoto));
                }
                if (wants(params, "video")) {
                    cameraVideo = new File(dir, "video-" + now + ".mp4");
                    capture.add(captureIntent(MediaStore.ACTION_VIDEO_CAPTURE, cameraVideo));
                }
            } catch (Exception ignored) {
                capture.clear();
            }
        }
        capture.removeIf(i -> i.resolveActivity(getPackageManager()) == null);
        Intent launch;
        if (params.isCaptureEnabled() && capture.size() == 1) {
            launch = capture.get(0);
        } else {
            launch = Intent.createChooser(pick, getString(R.string.choose_media));
            if (!capture.isEmpty()) launch.putExtra(Intent.EXTRA_INITIAL_INTENTS, capture.toArray(new Intent[0]));
        }
        try {
            startActivityForResult(launch, FILE_CHOOSER_REQUEST);
            return true;
        } catch (ActivityNotFoundException e) {
            pendingUpload.onReceiveValue(null);
            pendingUpload = null;
            return true;
        }
    }

    private Intent captureIntent(String action, File out) {
        Uri uri = FileProvider.getUriForFile(this, FILES, out);
        Intent i = new Intent(action).putExtra(MediaStore.EXTRA_OUTPUT, uri)
                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.setClipData(ClipData.newRawUri("", uri));
        return i;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || pendingUpload == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0
                    && data.getData() == null && data.getClipData().getItemAt(0).getUri() != null
                    && !isCameraUri(data.getClipData().getItemAt(0).getUri())) {
                ClipData clip = data.getClipData();
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                result = new Uri[] {data.getData()};
            }
            if (result == null) {
                File shot = taken(cameraPhoto) ? cameraPhoto : taken(cameraVideo) ? cameraVideo : null;
                if (shot != null) result = new Uri[] {FileProvider.getUriForFile(this, FILES, shot)};
            }
        }
        pendingUpload.onReceiveValue(result);
        pendingUpload = null;
    }

    private boolean isCameraUri(Uri uri) {
        return FILES.equals(uri.getAuthority());
    }

    private static boolean taken(File f) {
        return f != null && f.exists() && f.length() > 0;
    }

    /** Camera shots are copied by the page when uploaded; old ones can go. */
    private void cleanCameraFiles() {
        File[] old = new File(getCacheDir(), "camera").listFiles();
        if (old == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 3600_000L;
        Arrays.stream(old).filter(f -> f.lastModified() < cutoff).forEach(File::delete);
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        visible = false;
        CookieManager.getInstance().flush();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        webView.onResume();
        emitNotificationState(); // may have changed in Settings
    }

    @Override
    protected void onDestroy() {
        bridge.destroy();
        webView.destroy();
        super.onDestroy();
    }
}
