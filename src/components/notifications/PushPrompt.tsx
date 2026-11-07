"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BellRing, Check, Loader2, Lock, Send, Settings2, Share, SquarePlus, X } from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { disablePush, enablePush, onYoruApp, pushStatus, sendTestPush, yoruApp, type PushStatus } from "@/lib/client/push";

const SNOOZE = "yoru-push-snooze";
const snoozed = () => {
  try {
    return Number(localStorage.getItem(SNOOZE) ?? 0) > Date.now();
  } catch {
    return false;
  }
};

function Bell({ ringing }: { ringing?: boolean }) {
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <span className="push-pulse absolute inset-0 rounded-2xl bg-brand/25" />
      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_8px_24px_-8px_var(--brand)]">
        <BellRing size={22} className={clsx(ringing && "push-ring")} />
      </span>
    </span>
  );
}

const blockedHelp = () => yoruApp()
  ? "Notifications are off for YORU on this phone. Turn them on in the app's notification settings."
  : typeof navigator !== "undefined" && /Android/.test(navigator.userAgent)
    ? "Notifications are blocked. Open your phone's Settings → Apps → Chrome → Notifications, turn them on, then come back."
    : "Notifications are blocked for YORU in this browser. Click the icon left of the address bar → Notifications → Allow, then reload.";

function Blocked({ className }: { className?: string }) {
  const app = yoruApp();
  return (
    <div className={className}>
      <p className="flex gap-1.5 text-sm text-ink-2"><Lock size={15} className="mt-0.5 shrink-0" />{blockedHelp()}</p>
      {app && (
        <button type="button" onClick={() => app.openNotificationSettings()}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white">
          <Settings2 size={14} /> Open settings
        </button>
      )}
    </div>
  );
}

// "card": the invitation on Notifications and Inbox (hidden once on, or
// dismissed for two weeks). "settings": the full control in Settings.
export function PushPrompt({ variant = "card", className }: { variant?: "card" | "settings"; className?: string }) {
  const { toast, toastError } = useApp();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);
  // Nothing renders until the status is known (after mount), so reading
  // localStorage here can't cause a hydration mismatch.
  const [hidden, setHidden] = useState(() => variant === "card" && typeof window !== "undefined" && snoozed());

  useEffect(() => {
    let live = true;
    pushStatus().then((s) => live && setStatus(s)).catch(() => live && setStatus("unsupported"));
    // In the app: the member may have changed it in the phone's settings.
    const stop = yoruApp() ? onYoruApp((e) => { if (e.type === "notifications") pushStatus().then((s) => live && setStatus(s)); }) : null;
    return () => { live = false; stop?.(); };
  }, []);

  async function turnOn() {
    setBusy("on");
    try {
      const s = await enablePush(true);
      setStatus(s);
      if (s === "on") toast("Notifications are on. A test is on its way.", "success", "🔔");
      else if (s === "blocked") toast(yoruApp() ? "Notifications are off for YORU. You can turn them on in your phone's settings." : "Notifications were blocked. You can allow them in your browser settings.", "error");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  }
  async function turnOff() {
    setBusy("off");
    try {
      if (yoruApp()) {
        await disablePush(); // opens the phone's notification settings
        return;
      }
      setStatus(await disablePush());
      toast("Notifications are off on this device.", "success");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  }
  async function test() {
    setBusy("test");
    try {
      await sendTestPush();
      toast("Test sent. It should pop up in a moment.", "success", "🔔");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  }

  if (status === null) return null;

  if (variant === "card") {
    if (hidden || status === "on" || status === "unsupported" || status === "unavailable") return null;
    return (
      <div className={clsx("push-card relative overflow-hidden rounded-3xl border border-brand/30 bg-card p-4", className)}>
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
        <button type="button" onClick={() => { try { localStorage.setItem(SNOOZE, String(Date.now() + 14 * 864e5)); } catch {} setHidden(true); }}
          aria-label="Not now" className="absolute end-2.5 top-2.5 rounded-full p-1.5 text-muted hover:bg-card-2 hover:text-ink"><X size={16} /></button>
        <div className="relative flex gap-3.5">
          <Bell ringing={status === "off"} />
          <div className="min-w-0 flex-1 pe-5">
            <h3 className="font-black leading-tight">Never miss the night</h3>
            {status === "off" && (
              <>
                <p className="mt-1 text-sm text-ink-2">Get likes, replies, mentions and messages on your lock screen, even when YORU is closed. You choose which in Settings.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={turnOn} disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_6px_20px_-8px_var(--brand)] disabled:opacity-60">
                    {busy === "on" ? <Loader2 size={15} className="animate-spin" /> : <BellRing size={15} />} Turn on notifications
                  </button>
                </div>
              </>
            )}
            {status === "needs-install" && <InstallSteps />}
            {status === "blocked" && <Blocked className="mt-1" />}
          </div>
        </div>
      </div>
    );
  }

  // Settings
  return (
    <div className={clsx("flex gap-3 py-3", className)}>
      <Bell ringing={status === "on"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">Push notifications</h3>
          {status === "on" && <span className="inline-flex items-center gap-1 rounded-full bg-online/15 px-2 py-0.5 text-[11px] font-bold text-online"><Check size={11} /> On for this device</span>}
        </div>
        <p className="mt-0.5 text-sm text-muted">Alerts on this device even when YORU is closed. The switches below choose what you hear about.</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {status === "on" && (
            <>
              <button type="button" onClick={test} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm font-bold disabled:opacity-60">
                {busy === "test" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send a test
              </button>
              <button type="button" onClick={turnOff} disabled={busy !== null} className="rounded-full px-3.5 py-1.5 text-sm font-bold text-muted hover:text-ink disabled:opacity-60">
                {busy === "off" ? "Turning off…" : yoruApp() ? "Phone settings" : "Turn off"}
              </button>
            </>
          )}
          {status === "off" && (
            <button type="button" onClick={turnOn} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white disabled:opacity-60">
              {busy === "on" ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />} Turn on
            </button>
          )}
        </div>
        {status === "needs-install" && <InstallSteps />}
        {status === "blocked" && <Blocked className="mt-2" />}
        {status === "on" && yoruApp()?.pushMode() === "background" && (
          <p className="mt-2 text-xs text-muted">On this phone, new notifications can take up to about 15 minutes to show while YORU is closed.</p>
        )}
        {status === "unsupported" && <p className="mt-2 text-sm text-muted">This browser can&apos;t show notifications. Chrome, Edge, Firefox and Safari can.</p>}
        {status === "unavailable" && <p className="mt-2 text-sm text-muted">Push notifications aren&apos;t switched on for YORU yet.</p>}
      </div>
    </div>
  );
}

function InstallSteps() {
  return (
    <div className="mt-2 text-sm text-ink-2">
      <p>On iPhone and iPad, notifications work once YORU is on your Home Screen:</p>
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-card-2 text-xs font-bold">1</span> Tap <Share size={15} className="text-brand" /> Share in Safari</li>
        <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-card-2 text-xs font-bold">2</span> Choose <SquarePlus size={15} className="text-brand" /> Add to Home Screen</li>
        <li className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-card-2 text-xs font-bold">3</span> Open YORU from your Home Screen and turn notifications on</li>
      </ol>
    </div>
  );
}
