"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { Play, Volume2, VolumeX } from "lucide-react";

// One video player for the feed and Watch. It never shows the browser's own
// placeholder: Android's WebView draws a grey play button for a video that
// hasn't loaded a frame, and iOS shows nothing. Instead the first frame is
// loaded as the video comes near the screen, and the video plays muted while
// it is mostly visible (like Instagram). Sound is one shared switch.

// A transparent poster stops WebView from drawing its default play button.
const BLANK_POSTER = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let muted = true;
const listeners = new Set<() => void>();
function setMuted(m: boolean) {
  muted = m;
  listeners.forEach((l) => l());
}
function useMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
    () => true,
  );
}

// Only one video plays at a time.
let current: HTMLVideoElement | null = null;
function claim(v: HTMLVideoElement) {
  if (current && current !== v) current.pause();
  current = v;
}

function prefersStill() {
  if (typeof window === "undefined") return false;
  const forced = document.documentElement.dataset.motion;
  if (forced === "reduce") return true;
  if (forced === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function VideoPlayer({
  src,
  className,
  fill = false,
  tapToPause = false,
  label,
  onDoubleTap,
}: {
  src: string;
  className?: string;
  /** Fill the parent (Watch). Otherwise sized by the video, capped in height. */
  fill?: boolean;
  /** Tap pauses (Watch) instead of toggling sound (feed). */
  tapToPause?: boolean;
  label?: string;
  onDoubleTap?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const isMuted = useMuted();
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastTap = useRef(0);
  const visible = useRef(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tryPlay = useCallback(() => {
    const v = ref.current;
    if (!v || !v.currentSrc) return; // no source yet: onCanPlay retries
    claim(v);
    v.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, []);

  // Load the first frame when the video is near; play while mostly visible.
  useEffect(() => {
    const el = wrap.current;
    const v = ref.current;
    if (!el || !v) return;
    const nearIo = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "600px 0px" });
    const playIo = new IntersectionObserver(
      ([e]) => {
        visible.current = e.intersectionRatio >= 0.6;
        if (visible.current && !prefersStill() && document.visibilityState === "visible") tryPlay();
        else if (!visible.current && !v.paused) v.pause();
      },
      { threshold: [0, 0.6, 1] },
    );
    nearIo.observe(el);
    playIo.observe(el);
    const onHide = () => document.visibilityState === "hidden" && v.pause();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      nearIo.disconnect();
      playIo.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      if (current === v) current = null;
    };
  }, [tryPlay]);

  useEffect(() => {
    if (ref.current) ref.current.muted = isMuted;
  }, [isMuted]);

  const onTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (onDoubleTap && now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    const act = () => {
      const v = ref.current;
      if (!v) return;
      if (v.paused || blocked) return tryPlay();
      if (tapToPause) v.pause();
      else setMuted(!isMuted);
    };
    if (onDoubleTap) tapTimer.current = setTimeout(act, 280);
    else act();
  };

  const showPlay = (blocked || (!playing && ready && tapToPause) || (!playing && ready && prefersStill())) && !playing;

  return (
    <div
      ref={wrap}
      className={clsx("relative overflow-hidden bg-black", fill ? "h-full w-full" : "w-full", className)}
      onClick={onTap}
      role="button"
      tabIndex={0}
      aria-label={label ?? "Video"}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          const v = ref.current;
          if (v?.paused) tryPlay();
          else v?.pause();
        }
      }}
    >
      <video
        ref={ref}
        src={near ? `${src}#t=0.001` : undefined}
        poster={BLANK_POSTER}
        muted={isMuted}
        loop
        playsInline
        preload={near ? "auto" : "none"}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => visible.current && !prefersStill() && ref.current?.paused && !blocked && tryPlay()}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        className={clsx(
          "block w-full transition-opacity duration-200",
          fill ? "h-full object-contain" : "max-h-[min(78vh,640px)] min-h-[200px] object-contain",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      )}
      {showPlay && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
            <Play size={30} fill="currentColor" className="ms-1" />
          </span>
        </span>
      )}
      {!tapToPause && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMuted(!isMuted);
            if (ref.current?.paused) tryPlay();
          }}
          className="absolute bottom-3 end-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label={isMuted ? "Turn sound on" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden>
        <div className="h-full bg-white/80" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export { setMuted as setVideoMuted, useMuted as useVideoMuted };
