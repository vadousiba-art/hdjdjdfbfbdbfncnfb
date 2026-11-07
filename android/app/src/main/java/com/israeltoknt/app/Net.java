package com.israeltoknt.app;

import android.webkit.CookieManager;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.json.JSONObject;

/**
 * Calls YORU's API from outside the WebView (background checks, Firebase
 * registration) as the signed-in member: sends the WebView's session cookies
 * and saves any refreshed ones back, so the app stays signed in.
 */
final class Net {
    static final class Response {
        final int status;
        final JSONObject data;

        Response(int status, JSONObject data) {
            this.status = status;
            this.data = data;
        }

        boolean ok() {
            return status >= 200 && status < 300;
        }
    }

    private Net() {}

    static String userAgent() {
        return "YORU-App/" + BuildConfig.VERSION_NAME + " (Android; IsraelTokntAndroid/" + BuildConfig.VERSION_NAME + ")";
    }

    /** Blocking; never call on the main thread. Returns status 0 on network errors. */
    static Response call(String method, String path, JSONObject body) {
        HttpURLConnection c = null;
        try {
            CookieManager cookies = CookieManager.getInstance();
            c = (HttpURLConnection) new URL(BuildConfig.APP_URL + path).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(15_000);
            c.setReadTimeout(20_000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", userAgent());
            String jar = cookies.getCookie(BuildConfig.APP_URL);
            if (jar != null) c.setRequestProperty("Cookie", jar);
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                c.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream out = c.getOutputStream()) {
                    out.write(bytes);
                }
            }
            int status = c.getResponseCode();
            for (Map.Entry<String, List<String>> h : c.getHeaderFields().entrySet()) {
                if (h.getKey() != null && h.getKey().equalsIgnoreCase("Set-Cookie")) {
                    for (String v : h.getValue()) cookies.setCookie(BuildConfig.APP_URL, v);
                    cookies.flush();
                }
            }
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            JSONObject data = null;
            if (in != null) {
                try (InputStream s = in) {
                    ByteArrayOutputStream buf = new ByteArrayOutputStream();
                    byte[] chunk = new byte[8192];
                    int n;
                    while ((n = s.read(chunk)) > 0 && buf.size() < 512 * 1024) buf.write(chunk, 0, n);
                    String text = buf.toString("UTF-8");
                    if (text.startsWith("{")) data = new JSONObject(text).optJSONObject("data");
                }
            }
            return new Response(status, data);
        } catch (Exception e) {
            return new Response(0, null);
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
