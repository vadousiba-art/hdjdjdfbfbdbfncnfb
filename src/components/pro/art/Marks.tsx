"use client";

import { useId } from "react";
import clsx from "clsx";
import type { BadgeP, CollectionP, MilestoneP, NameplateP } from "@/lib/pro/catalog";

// Nameplates: a title under or beside the name, never a staff or verified label.
export function Nameplate({ p, className, still }: { p: NameplateP; className?: string; still?: boolean }) {
  const style = { "--np-a": p.a, "--np-b": p.b } as React.CSSProperties;
  return (
    <span
      className={clsx("pro-np", `pro-np-${p.fx}`, `pro-np-font-${p.font}`, `pro-np-border-${p.border}`, still && "pro-still", className)}
      style={style}
      data-text={p.title}
    >
      {p.emblem && <span className="pro-np-emblem" aria-hidden>{p.emblem}</span>}
      <span className="pro-np-text">{p.title}</span>
    </span>
  );
}

const SHAPES: Record<BadgeP["shape"], string> = {
  seal: "M5,5 H35 V35 H5 Z",
  shield: "M20,3 L35,8 V19 C35,28 28,34 20,37 C12,34 5,28 5,19 V8 Z",
  star: "M20,2 L25,14 L38,15 L28,24 L31,37 L20,30 L9,37 L12,24 L2,15 L15,14 Z",
  crest: "M8,4 H32 L36,10 V22 C36,30 28,35 20,38 C12,35 4,30 4,22 V10 Z",
  coin: "M20,2 A18,18 0 1,1 19.99,2 Z",
  gem: "M10,6 H30 L37,15 L20,37 L3,15 Z",
  lotus: "M20,6 C25,12 25,20 20,26 C15,20 15,12 20,6 Z M20,26 C12,26 6,20 5,14 C12,14 17,19 20,26 Z M20,26 C28,26 34,20 35,14 C28,14 23,19 20,26 Z M8,30 H32 C30,34 25,36 20,36 C15,36 10,34 8,30 Z",
  heart: "M20,35 C8,26 3,19 3,12 C3,6 8,3 12,3 C16,3 19,6 20,9 C21,6 24,3 28,3 C32,3 37,6 37,12 C37,19 32,26 20,35 Z",
  hex: "M20,2 L36,11 V29 L20,38 L4,29 V11 Z",
  orbit: "M20,2 A18,18 0 1,1 19.99,2 Z",
  shard: "M20,2 L31,14 L26,38 L14,38 L9,14 Z",
  moon: "M20,2 A18,18 0 1,1 19.99,2 Z",
  flower: "M20,4 A6,6 0 0,1 26,12 A6,6 0 0,1 34,18 A6,6 0 0,1 28,26 A6,6 0 0,1 22,34 A6,6 0 0,1 14,30 A6,6 0 0,1 6,24 A6,6 0 0,1 10,14 A6,6 0 0,1 20,4 Z",
  token: "M20,2 A18,18 0 1,1 19.99,2 Z",
  prism: "M20,3 L37,35 H3 Z",
  // A microchip: a square body with three pins on each side.
  chip: "M10,8 H30 Q32,8 32,10 V30 Q32,32 30,32 H10 Q8,32 8,30 V10 Q8,8 10,8 Z M12.8,3 h2.4 v5 h-2.4 Z M12.8,32 h2.4 v5 h-2.4 Z M18.8,3 h2.4 v5 h-2.4 Z M18.8,32 h2.4 v5 h-2.4 Z M24.8,3 h2.4 v5 h-2.4 Z M24.8,32 h2.4 v5 h-2.4 Z M3,12.8 h5 v2.4 h-5 Z M32,12.8 h5 v2.4 h-5 Z M3,18.8 h5 v2.4 h-5 Z M32,18.8 h5 v2.4 h-5 Z M3,24.8 h5 v2.4 h-5 Z M32,24.8 h5 v2.4 h-5 Z",
};

// Badges glow, catch a moving highlight and give their glyph a small beat.
const SPIN = new Set<BadgeP["shape"]>(["coin", "token", "orbit"]);
export function BadgeArt({ p, size = 28, title, still }: { p: BadgeP; size?: number; title?: string; still?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const clip = `${uid}c`;
  return (
    <svg viewBox="-4 -4 48 48" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      className={clsx("shrink-0 overflow-visible", (still ?? size < 24) && "pro-still")}>
      <defs>
        <clipPath id={clip}><path d={SHAPES[p.shape]} /></clipPath>
      </defs>
      <path className="pr a-breathe" d={SHAPES[p.shape]} fill="none" stroke={p.a} strokeWidth="3" opacity="0.35" style={{ filter: `blur(1.5px)` }} />
      <g className={clsx("pr", SPIN.has(p.shape) ? "a-sway" : "a-bob")} style={{ "--d": "3.6s" } as React.CSSProperties}>
        <path d={SHAPES[p.shape]} fill={p.b} stroke={p.a} strokeWidth="2" strokeLinejoin="round" />
        {p.shape === "orbit" && <ellipse className="pr a-rot" cx="20" cy="20" rx="17" ry="7" fill="none" stroke={p.a} strokeWidth="1.4" transform="rotate(-25 20 20)" style={{ "--d": "8s" } as React.CSSProperties} />}
        {(p.shape === "token" || p.shape === "coin") && <circle cx="20" cy="20" r="13.5" fill="none" stroke={p.a} strokeWidth="1" strokeOpacity="0.6" strokeDasharray="3 2" className="pr a-rot" style={{ "--d": "14s" } as React.CSSProperties} />}
        <g clipPath={`url(#${clip})`}>
          <rect className="pr a-sheen-b" x="-14" y="-6" width="10" height="52" fill="#fff" opacity="0.35" style={{ "--d": "3.8s" } as React.CSSProperties} />
        </g>
        <text className="pr a-pop" x="20" y="21" fontSize={p.glyph.length > 1 ? 11 : 15} textAnchor="middle" dominantBaseline="central" fill={p.a} fontWeight="800" style={{ "--d": "4s" } as React.CSSProperties}>
          {p.glyph}
        </text>
      </g>
    </svg>
  );
}

// Earned emblems turn slowly and glow; unearned ones stay grey and still.
export function MilestoneEmblem({ p, earned, size = 56 }: { p: MilestoneP; earned: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} aria-hidden className={clsx("shrink-0 overflow-visible", !earned && "pro-still opacity-45 grayscale")}>
      {earned && <circle className="pr a-breathe" cx="30" cy="30" r="28" fill="none" stroke={p.a} strokeWidth="3" opacity="0.4" style={{ filter: "blur(2px)" }} />}
      <circle cx="30" cy="30" r="27" fill={p.b} stroke={p.a} strokeWidth="2.5" />
      <circle className="pr a-rot" cx="30" cy="30" r="22" fill="none" stroke={p.a} strokeOpacity="0.5" strokeWidth="1" strokeDasharray={earned ? "6 3" : "2 3"} style={{ "--d": "16s" } as React.CSSProperties} />
      {earned && [0, 120, 240].map((d, i) => (
        <circle key={d} className="pr a-twinkle" cx={30 + 24.5 * Math.cos((d * Math.PI) / 180)} cy={30 + 24.5 * Math.sin((d * Math.PI) / 180)} r="1.2" fill="#fff" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <text className="pr a-bob" x="30" y="31" fontSize={p.emblem.length > 1 ? 14 : 22} textAnchor="middle" dominantBaseline="central" fill={p.a} fontWeight="800">
        {p.emblem}
      </text>
    </svg>
  );
}

// Collection covers: a pattern in the template's colours behind the emoji.
const COVER_BG: Record<CollectionP["cover"], (a: string, b: string) => string> = {
  panels: (a, b) => `linear-gradient(${b},${b}) padding-box, conic-gradient(from 45deg, ${a}33 0 25%, transparent 0 50%, ${a}22 0 75%, transparent 0) 0 0/50% 50%, ${b}`,
  shelf: (a, b) => `repeating-linear-gradient(90deg, ${a} 0 10px, ${b} 10px 13px, ${a}cc 13px 21px, ${b} 21px 24px), ${b}`,
  frames: (a, b) => `linear-gradient(${b},${b}) 12% 20%/30% 40% no-repeat, linear-gradient(${b},${b}) 60% 30%/30% 50% no-repeat, linear-gradient(135deg, ${a}, ${a}88)`,
  wave: (a, b) => `repeating-radial-gradient(circle at 50% 120%, ${a}55 0 3px, transparent 3px 14px), ${b}`,
  grid: (a, b) => `linear-gradient(${a}22 1px, transparent 1px) 0 0/14px 14px, linear-gradient(90deg, ${a}22 1px, transparent 1px) 0 0/14px 14px, ${b}`,
  board: (a, b) => `radial-gradient(circle at 20% 30%, ${a} 0 4px, transparent 5px), radial-gradient(circle at 70% 60%, ${a} 0 4px, transparent 5px), linear-gradient(135deg, ${b}, ${a}33)`,
  halftone: (a, b) => `radial-gradient(${a} 1.4px, transparent 1.8px) 0 0/8px 8px, ${b}`,
  cards: (a, b) => `linear-gradient(100deg, transparent 30%, ${a}55 30% 55%, transparent 55%), linear-gradient(80deg, transparent 45%, ${a}88 45% 70%, transparent 70%), ${b}`,
  stars: (a, b) => `radial-gradient(1.5px 1.5px at 20% 30%, ${a}, transparent), radial-gradient(1px 1px at 60% 20%, #fff, transparent), radial-gradient(2px 2px at 80% 70%, ${a}, transparent), radial-gradient(1px 1px at 35% 75%, #fff, transparent), radial-gradient(ellipse at top, ${a}33, ${b} 70%)`,
  plain: (a, b) => `linear-gradient(135deg, ${b}, ${a}44)`,
  stamp: (a, b) => `radial-gradient(circle at 75% 30%, transparent 18px, ${a} 19px 21px, transparent 22px), ${b}`,
  rain: (a, b) => `repeating-linear-gradient(105deg, ${a}33 0 1px, transparent 1px 9px), ${b}`,
  petals: (a, b) => `radial-gradient(ellipse 6px 3px at 25% 30%, ${a}, transparent), radial-gradient(ellipse 5px 3px at 70% 50%, ${a}, transparent), radial-gradient(ellipse 6px 3px at 40% 80%, ${a}, transparent), ${b}`,
  pixel: (a, b) => `conic-gradient(${a}55 25%, transparent 0 50%, ${a}22 0 75%, transparent 0) 0 0/12px 12px, ${b}`,
  ink: (a, b) => `radial-gradient(60% 50% at 30% 70%, ${a} 0 40%, transparent 41%), radial-gradient(30% 30% at 75% 30%, ${a} 0 40%, transparent 41%), ${b}`,
};
export function coverBackground(p: CollectionP) {
  return COVER_BG[p.cover](p.a, p.b);
}
export function CoverArt({ p, emoji, className, children }: { p: CollectionP; emoji?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={clsx("relative flex items-center justify-center overflow-hidden", className)} style={{ background: coverBackground(p) }}>
      <span aria-hidden className="pr a-sheen-w pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/10" style={{ "--d": "5s" } as React.CSSProperties} />
      <span className="pr a-bob text-3xl drop-shadow" aria-hidden>{emoji ?? p.emoji}</span>
      {children}
    </div>
  );
}
