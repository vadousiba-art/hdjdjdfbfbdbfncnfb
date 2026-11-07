"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

// Atlas's core: a glowing orb that breathes when idle, follows your voice when
// listening, spins an arc while thinking and pulses a waveform while speaking.
// Pure CSS animation (GPU transforms only); the mic level is applied straight
// to a CSS variable from a ref, so the page never re-renders per frame.
export function AtlasOrb({ state, level, size = 168, className }: { state: OrbState; level?: React.RefObject<number>; size?: number; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = el.current;
    if (state !== "listening" || !level || !node) return;
    let raf = 0;
    let smooth = 0;
    const tick = () => {
      smooth += ((level.current ?? 0) - smooth) * 0.35;
      node.style.setProperty("--lvl", smooth.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      node.style.setProperty("--lvl", "0");
    };
  }, [state, level]);

  return (
    <div ref={el} className={clsx("atlas-orb", `atlas-${state}`, className)} style={{ width: size, height: size }} role="img"
      aria-label={state === "listening" ? "Atlas is listening" : state === "thinking" ? "Atlas is thinking" : state === "speaking" ? "Atlas is speaking" : "Atlas"}>
      <span className="atlas-halo" />
      <span className="atlas-ring atlas-ring-1" />
      <span className="atlas-ring atlas-ring-2" />
      <span className="atlas-arc" />
      <span className="atlas-core" />
      <span className="atlas-wave" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}
      </span>
    </div>
  );
}
