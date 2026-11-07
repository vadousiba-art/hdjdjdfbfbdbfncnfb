"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Captions, CaptionsOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/components/providers/I18nProvider";
import { CURRENT_RELEASE } from "@/lib/releases";
import { pickSource, type WelcomeConfig, type WelcomeCut } from "@/lib/welcome/config";
import type { MessageKey } from "@/lib/i18n/messages/en";

export type CloseReason = "skip" | "enter" | "ended" | "error";

// Full-screen player for the welcome film. It never traps anyone: Skip and
// Escape always work, a failed video falls back to readable highlights, and
// sound only plays after the viewer turns it on.
export function WelcomePlayer({
  config,
  cut,
  onClose,
  enterHref,
  onReadInstead,
}: {
  config: WelcomeConfig;
  cut: WelcomeCut;
  onClose: (reason: CloseReason) => void;
  enterHref?: string; // public landing: "Join YORU" goes here
  onReadInstead?: () => void;
}) {
  const { t, locale } = useI18n();
  const meta = config[cut];
  const video = useRef<HTMLVideoElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<{ webm: string; mp4: string; poster: string; portrait: boolean } | null>(null);
  const [state, setState] = useState<"loading" | "blocked" | "playing" | "paused" | "ended" | "error">("loading");
  const [muted, setMuted] = useState(true);
  const [cc, setCc] = useState(locale !== "en"); // the film's on-screen type is English
  const [time, setTime] = useState(0);
  const [reduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [lite, setLite] = useState(false); // data saver or a slow connection: wait for a tap

  // Choose the file for this screen and connection; swap on rotation.
  useEffect(() => {
    const choose = () => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const saveData = Boolean(conn?.saveData);
      const slow = /(^|-)2g$|^3g$/.test(conn?.effectiveType ?? "");
      setLite(saveData || slow);
      const next = pickSource(meta, {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(window.devicePixelRatio || 1, 3),
        saveData,
        slow,
      });
      setSrc((cur) => (cur && cur.portrait === next.portrait ? cur : next));
    };
    choose();
    window.addEventListener("resize", choose);
    return () => window.removeEventListener("resize", choose);
  }, [meta]);

  // Keep the playhead when the source changes (rotation).
  const resumeAt = useRef(0);
  const resumePlay = useRef(false);
  useEffect(() => {
    const v = video.current;
    if (!v || !src) return;
    resumeAt.current = v.currentTime || resumeAt.current;
    resumePlay.current = !v.paused;
    v.load();
  }, [src]);

  const start = useCallback(async () => {
    const v = video.current;
    if (!v) return;
    try {
      await v.play();
    } catch {
      setState("blocked"); // autoplay not allowed (e.g. Android WebView): wait for a tap
    }
  }, []);

  const onReady = () => {
    const v = video.current;
    if (!v) return;
    if (resumeAt.current > 0) v.currentTime = resumeAt.current;
    if (reduce || lite) setState("blocked");
    else void start();
  };

  const close = useCallback(
    (reason: CloseReason) => {
      const v = video.current;
      if (v) {
        v.pause();
        v.querySelectorAll("source").forEach((el) => el.removeAttribute("src"));
        v.load(); // stop downloading
      }
      onClose(reason);
    },
    [onClose],
  );

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void start();
    else v.pause();
  }, [start]);

  const seek = useCallback((dt: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || meta.duration, v.currentTime + dt));
  }, [meta.duration]);

  // Keyboard: Space/K play, M mute, C captions, arrows seek, Escape skip; focus stays inside.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") return close("skip");
      if (k === " " || k === "k") {
        if ((e.target as HTMLElement)?.tagName === "BUTTON" && k === " ") return;
        e.preventDefault();
        toggle();
      } else if (k === "m") setMuted((m) => !m);
      else if (k === "c") setCc((c) => !c);
      else if (k === "arrowright") seek(5);
      else if (k === "arrowleft") seek(-5);
      else if (k === "tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [close, toggle, seek]);

  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  const caption = useMemo(() => {
    const c = meta.captions.find((x) => time >= x.start && time <= x.end);
    if (!c) return null;
    const tr = t(c.key as MessageKey);
    return tr === c.key ? c.lines.join(" ") : tr;
  }, [meta.captions, time, t]);

  const pct = Math.min(100, (time / meta.duration) * 100);
  const endPhase = state === "ended" || time > meta.duration - 3.6;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const enter = () => (enterHref ? (window.location.href = enterHref) : close("enter"));
  const enterLabel = enterHref ? t("welcome.join") : t("welcome.enter");

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={t(cut === "full" ? "welcome.full" : "welcome.short")}
      className="fixed inset-0 z-[95] flex flex-col bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* brand framing */}
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[18px] border border-white/10 sm:inset-3" />
      <div aria-hidden className="pointer-events-none absolute -end-6 -top-6 h-12 w-12 rotate-45 bg-brand" />

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo width={92} />
          <span className="hidden truncate text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 sm:inline">
            {t(cut === "full" ? "welcome.full" : "welcome.short")}
          </span>
        </div>
        <button
          onClick={() => close("skip")}
          className="rounded-full border border-white/25 bg-black/60 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
          data-autofocus={!endPhase || undefined}
        >
          {enterHref ? t("welcome.close") : t("welcome.skip")}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 py-2 sm:px-6">
        {state !== "error" && src && (
          <video
            ref={video}
            className="h-full max-h-full w-full max-w-full object-contain"
            poster={src.poster}
            muted={muted}
            playsInline
            preload={lite ? "none" : "auto"}
            onCanPlay={() => {
              if (state === "loading") return onReady();
              const v = video.current;
              if (v && resumeAt.current > 0 && Math.abs(v.currentTime - resumeAt.current) > 0.5) {
                v.currentTime = resumeAt.current;
                if (resumePlay.current) void start();
              }
            }}
            onPlay={() => setState("playing")}
            onPause={() => setState((s) => (s === "ended" ? s : "paused"))}
            onEnded={() => setState("ended")}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onError={() => setState("error")}
            aria-describedby="welcome-desc"
          >
            <source src={src.webm} type='video/webm; codecs="vp9, opus"' />
            {/* the last source failing means no playable file: show the fallback */}
            <source src={src.mp4} type="video/mp4" onError={() => setState("error")} />
          </video>
        )}
        <p id="welcome-desc" className="sr-only">
          {t("welcome.description")}
        </p>

        {state === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" role="status">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-brand motion-reduce:animate-none" />
            <span className="text-sm text-white/60">{t("welcome.loading")}</span>
          </div>
        )}

        {state === "blocked" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40">
            <button
              onClick={() => void start()}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-2xl hover:scale-105"
              aria-label={t("welcome.play")}
              data-autofocus
            >
              <Play size={34} fill="currentColor" />
            </button>
            <span className="text-sm font-semibold text-white/80">{t("welcome.blocked")}</span>
            {onReadInstead && (
              <button onClick={onReadInstead} className="text-sm text-white/70 underline underline-offset-4 hover:text-white">
                {t("welcome.readInstead")}
              </button>
            )}
          </div>
        )}

        {state === "error" && (
          <div className="mx-auto max-w-lg overflow-y-auto px-4 py-6" role="alert">
            <h2 className="text-2xl font-black">{t("welcome.title")}</h2>
            <p className="mt-1 text-sm text-white/60">{t("welcome.error")}</p>
            <ul className="mt-4 space-y-3">
              {CURRENT_RELEASE.slides.slice(1).map((s) => (
                <li key={s.kicker} className="border-s-2 border-brand ps-3">
                  <div className="text-sm font-bold">{s.title}</div>
                  <div className="text-sm text-white/70">{s.body}</div>
                </li>
              ))}
              <li className="border-s-2 border-white/30 ps-3">
                <div className="text-sm font-bold">YORU Pro</div>
                <div className="text-sm text-white/70">{t("welcome.pro")}</div>
              </li>
            </ul>
          </div>
        )}

        {cc && caption && state !== "error" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-6" aria-live="off">
            <span dir="auto" className="rounded-lg bg-black/75 px-3 py-1.5 text-center text-base font-semibold leading-snug sm:text-lg">
              {caption}
            </span>
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 pb-4 sm:px-6">
        {state !== "error" && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={t("welcome.progress")}
            aria-valuemin={0}
            aria-valuemax={Math.round(meta.duration)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={`${fmt(time)} / ${fmt(meta.duration)}`}
            className="group mb-3 h-2 cursor-pointer rounded-full bg-white/15"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const k = (document.documentElement.dir === "rtl" ? r.right - e.clientX : e.clientX - r.left) / r.width;
              if (video.current) video.current.currentTime = Math.max(0, Math.min(1, k)) * meta.duration;
            }}
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {state !== "error" && (
            <>
              <button onClick={toggle} className="rounded-full p-2.5 hover:bg-white/10" aria-label={state === "playing" ? t("welcome.pause") : t("welcome.play")}>
                {state === "playing" ? <Pause size={20} /> : state === "ended" ? <RotateCcw size={20} /> : <Play size={20} />}
              </button>
              <button
                onClick={() => setMuted((m) => !m)}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold",
                  muted ? "bg-white text-black hover:bg-white/90" : "hover:bg-white/10",
                )}
                aria-pressed={!muted}
                aria-label={muted ? t("welcome.unmute") : t("welcome.mute")}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                {muted && <span>{t("welcome.soundOn")}</span>}
              </button>
              <button onClick={() => setCc((c) => !c)} className="rounded-full p-2.5 hover:bg-white/10" aria-pressed={cc} aria-label={t("welcome.captions")}>
                {cc ? <Captions size={20} /> : <CaptionsOff size={20} />}
              </button>
              <span className="ms-1 text-xs tabular-nums text-white/60">
                {fmt(time)} / {fmt(meta.duration)}
              </span>
            </>
          )}
          <div className="ms-auto flex items-center gap-2">
            {state === "ended" && (
              <button
                onClick={() => {
                  if (video.current) video.current.currentTime = 0;
                  void start();
                }}
                className="rounded-full border border-white/25 px-4 py-2 text-sm font-bold hover:bg-white/10"
              >
                {t("welcome.replay")}
              </button>
            )}
            <button
              onClick={enter}
              data-autofocus={endPhase || state === "error" || undefined}
              className={clsx(
                "rounded-full px-5 py-2 text-sm font-black tracking-wide transition-colors",
                endPhase || state === "error" ? "bg-brand text-white hover:bg-brand-2" : "border border-white/25 text-white hover:bg-white/10",
              )}
            >
              {enterLabel} →
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
