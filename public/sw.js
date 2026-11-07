/* YORU service worker: push notifications only (no offline caching).
 * Shows each push, sets the app icon badge, and opens the right page when a
 * notification is tapped. docs/notifications.md */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      if (typeof d.unread === "number" && "setAppBadge" in self.navigator) {
        (d.unread > 0 ? self.navigator.setAppBadge(d.unread) : self.navigator.clearAppBadge()).catch(() => {});
      }
      await self.registration.showNotification(d.title || "YORU", {
        body: d.body || "",
        icon: d.icon || "/brand/yoru/app-icon-512.png",
        badge: "/brand/yoru/badge-96.png",
        tag: d.tag || undefined,
        renotify: Boolean(d.renotify && d.tag),
        timestamp: Date.now(),
        data: { url: d.url || "/notifications" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/notifications", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const mine = wins.find((c) => new URL(c.url).origin === self.location.origin);
      if (mine) {
        await mine.focus();
        if ("navigate" in mine) return mine.navigate(url).catch(() => self.clients.openWindow(url));
        return;
      }
      return self.clients.openWindow(url);
    })(),
  );
});

// Push services occasionally rotate a device's subscription; re-register it so
// notifications keep arriving without the member doing anything.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
      if (!key) return;
      const sub = event.newSubscription || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await fetch("/api/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), device: "renewed" }),
      }).catch(() => {});
    })(),
  );
});
