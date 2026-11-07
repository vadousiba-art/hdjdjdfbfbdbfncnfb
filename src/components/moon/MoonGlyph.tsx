"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import type { MoonPhase } from "@/lib/types";

// The five Moonrise phases (docs/MOONRISE.md), drawn as a real moon: a dark
// disc whose lit part grows from a sliver to full; Blood Moon is full and red.
export const MOON_PHASES = ["New Moon", "Crescent", "Half Moon", "Full Moon", "Blood Moon"] as const;
const LIT = [0, 0.24, 0.5, 1, 1];

export function phaseIndex(p: number | string | null | undefined): MoonPhase {
  if (typeof p === "number") return Math.min(4, Math.max(0, Math.round(p))) as MoonPhase;
  const i = MOON_PHASES.indexOf((p ?? "") as (typeof MOON_PHASES)[number]);
  return (i < 0 ? 0 : i) as MoonPhase;
}

export const phaseName = (p: number | string | null | undefined) => MOON_PHASES[phaseIndex(p)];

export function MoonGlyph({
  phase,
  size = 18,
  glow = false,
  dim = false,
  className,
}: {
  phase: number | string;
  size?: number;
  glow?: boolean; // a slow pulse of light (Full and Blood Moon)
  dim?: boolean; // a phase not reached yet
  className?: string;
}) {
  const i = phaseIndex(phase);
  const f = LIT[i];
  const blood = i === 4;
  const lit = blood ? "#ff3d55" : "#f3efe3";
  const c = 12;
  const r = 9.5;
  const rx = r * Math.abs(1 - 2 * f);
  // lit limb on the right; the terminator bulges right for a crescent, left past half
  const d = f > 0 && f < 1 ? `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${f < 0.5 ? 0 : 1} ${c} ${c - r} Z` : null;
  const shine = blood ? "rgb(255 61 85 / 0.75)" : "rgb(243 239 227 / 0.65)";
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={clsx("shrink-0 overflow-visible", dim && "opacity-35", className)}
      aria-hidden
      animate={glow ? { filter: [`drop-shadow(0 0 0px ${shine})`, `drop-shadow(0 0 ${size / 5}px ${shine})`, `drop-shadow(0 0 0px ${shine})`] } : undefined}
      transition={glow ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <circle cx={c} cy={c} r={r} fill="#17161d" stroke="currentColor" strokeOpacity={0.32} strokeWidth={1} />
      {f >= 1 ? <circle cx={c} cy={c} r={r} fill={lit} /> : d ? <path d={d} fill={lit} /> : null}
      {f >= 1 && (
        <g fill={blood ? "#c41f38" : "#ddd6c4"} opacity={0.55}>
          <circle cx={9} cy={9.5} r={1.7} />
          <circle cx={14.6} cy={13.8} r={2.2} />
          <circle cx={10.4} cy={15.6} r={1} />
        </g>
      )}
    </motion.svg>
  );
}
