# Push notifications

Members can get YORU's notifications on their lock screen even when YORU is closed: on the website (Chrome, Edge, Firefox, Safari on Mac), the installed web app on iPhone/iPad (iOS 16.4+, once YORU is on the Home Screen) and the Android app (in the notification shade). Push is off until a member allows it.

## How it works

```
like / comment / reply / mention / message / award / level-up / Night Watch notice
        │  (already filtered by the member's notification settings, blocks and bans)
        ▼
public.notifications ──trigger──▶ public.push_outbox   (only if the member has a device)
        ▼
any write request ─▶ schedulePush() ─▶ push_claim() ─▶ wordPush() ─▶ web-push (encrypt + VAPID sign)
        ▼                                                                 │
push_report() (ok / gone / failed)  ◀────────────────────────────────────┘
        ▼
the device's push service (FCM / Mozilla / Apple / Microsoft) ─▶ public/sw.js ─▶ notification
```

- **What's pushed** mirrors `public.notifications`, so the existing toggles in Settings → Notifications (likes, comments, mentions, reposts, messages, awards, friend activity), blocks and bans apply automatically. Wording is in `src/lib/push.ts` (tested): "Zach · liked your post", "Zach · commented: “…”", DMs show the sender and message (high urgency, re-alerting, one per chat), likes on one post collapse into one, Night Watch notices come from "YORU · Night Watch". Tapping opens the post, chat, Account Standing or Notifications. The app icon shows the unread count where supported.
- **Sending.** After every write (any RPC that isn't a read, and the server's own writes) the server sends what's queued, in the background (`waitUntil`), one pass at a time per instance (`src/lib/server/push.ts`). Notifications created with no request around (scheduled posts published by pg_cron) go out with the next write anyone makes.
- **Delivery hygiene.** Payloads are encrypted per device (RFC 8291, aes128gcm) and signed with YORU's VAPID key (RFC 8292). TTL is 24 h; a `topic` lets newer pushes replace older ones while a phone is offline. Devices the push service reports gone (404/410) are removed, and so are devices that fail 5 times in a row. Up to 10 devices per member.
- **Turning it on.** The permission prompt only appears from a tap on **Turn on notifications** (Notifications page, Inbox, Settings → Notifications). A test notification is sent straight away. iPhone/iPad in Safari get Home Screen steps instead; if permission was refused, the card explains how to allow it. Each visit quietly re-links the device to whoever is signed in (another account may have used the browser) and clears the app badge.
- **Privacy.** The database stores each device's push address, its two public keys (Web Push) or its Firebase token (Android app), and a short name like "Chrome on Windows" (migration 0014, private to its owner). Web Push services can't read notification contents; on the Firebase route Google carries the title and text. See the Privacy Policy, section 4 ("Push notifications", "Android app permissions").

## The Android app

`android/` is YORU in a full-screen WebView (plain Java, `com.israeltoknt.app`, package `com.yoru.social`, signed with the same release key as every earlier version, SHA-256 `5A:4C:56:…:9F:52`), version 2.4.0 (code 7). It installs over every earlier version. The app owns the phone's permissions:

- **First launch** shows a branded "Set up YORU" screen listing notifications, microphone and camera with what each is for; **Continue** brings up Android's own permission dialogs (each can be allowed or refused) and **Not now** skips. Nothing is asked again unless a feature needs it.
- **Microphone/camera on YORU pages** (`onPermissionRequest`): granted straight away for YORU's own origin when Android already allows them, with no browser-style prompt. If not allowed yet, the app shows Android's dialog; if it's permanently off, it offers to open the app's settings. Other origins are always denied. The file picker offers "take a photo/video" (FileProvider), asking for the camera first if needed.
- **Notifications** go to the notification shade through two channels, *Messages* (high importance) and *Activity*, with the moon icon in YORU red, the sender's photo, the unread count, and one notification per post/chat (same tags as Web Push). Tapping opens the right page in the app. The WebView has no Web Push, so delivery is:
  - **Background check (works now):** WorkManager calls `GET /api/push/app/pending` about every 15 minutes (Android's minimum; it can wait longer to save battery) with the app's session cookie, and shows new unread notifications worded exactly like pushes. Skipped while YORU is open.
  - **Instant (once Firebase is set up):** `GET /api/push/app` returns Firebase's public app settings, the app starts Firebase with them at runtime (no new APK needed), and registers its token (`POST /api/push/app`, stored as a `push_subscriptions` row with `kind = 'fcm'`). The server sends through FCM HTTP v1 (`src/lib/server/push.ts`), and Android shows it even if YORU was swiped away. The background check stops while instant delivery is on.
- **`window.YoruApp`** (`AppBridge.java`) lets the page read and request the notification permission, open the notification settings, send a local test, and keep the Firebase registration on the signed-in member (`src/lib/client/push.ts`, `PushPrompt`). Atlas reads replies aloud with the phone's text-to-speech through it (the WebView has no `speechSynthesis`). Results arrive as `yoru-app` events.
- **Sign-out** unregisters the device on the website and in the app (`forgetPushDevice()`), so the next account on that phone or browser doesn't get the previous member's notifications.

Build: `cd android && gradle :app:assembleRelease` (needs `android/keystore.properties`), then copy `app/build/outputs/apk/release/app-release.apk` to `public/download/yoru.apk` and update `APK_META` in `src/components/landing/GlowButton.tsx`. The paused native Kotlin app is in `android-native/`.

## Setup

**Web Push:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (generate once with `npx web-push generate-vapid-keys`; the private key is Sensitive in Vercel), optional `VAPID_SUBJECT`. Changing the keys invalidates every device's subscription; members would need to turn notifications on again.

**Instant notifications in the Android app (optional):** Firebase's terms require an adult account holder.

1. In the [Firebase console](https://console.firebase.google.com), create a project (Analytics not needed).
2. Add an Android app with package name `com.yoru.social`. Skip downloading `google-services.json` and the SDK steps; the app is already built for this.
3. In Project settings → General → your Android app, copy the **App ID** (`1:…:android:…`) and, under the project, the **Web API key**.
4. In Project settings → Service accounts, choose **Generate new private key** (a JSON file). Never commit or share it.
5. In Vercel → Settings → Environment Variables (Production): `FIREBASE_SERVICE_ACCOUNT` = the whole JSON (or base64 of it), Sensitive; `FIREBASE_ANDROID_APP_ID` = the App ID; `FIREBASE_API_KEY` = the Web API key. Optional `FIREBASE_SENDER_ID` (otherwise taken from the App ID). Redeploy.
6. Phones switch to instant delivery the next time YORU is opened. Without these, the background check keeps working.

## Testing

`tests/unit/push.test.ts` (wording, links, grouping), `tests/unit/push-fcm.test.ts` (Firebase sign-in JWT is validly signed and shared, message shape, gone tokens) and `tests/db/push.test.ts` (subscriptions are private and move with the signed-in member, only members with a device queue pushes, settings and blocks apply, claim/report hygiene, Firebase tokens). End to end was checked against a stand-in push service that decrypts payloads and verifies VAPID signatures, with the service worker displaying a push delivered through Chrome DevTools (open-source Chromium can't register with Google's push service, so a real phone is the final check).
