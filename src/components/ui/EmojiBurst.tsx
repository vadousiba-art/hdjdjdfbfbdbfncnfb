"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { ReactionP } from "@/lib/pro/catalog";

type Burst = { id: number; x: number; y: number; emoji: string; fx: ReactionP | null };
let push: ((b: Omit<Burst, "id">) => void) | null = null;
let seq = 1;

// Reaction Cosmetics: the member's equipped burst style (set by ProRuntime).
// It only changes this animation; the reaction itself is the same for everyone.
let style: ReactionP | null = null;
export function setBurstStyle(fx: ReactionP | null) {
  style = fx;
}

// Fire-and-forget emoji explosion at a screen position (likes, awards...).
export function burst(emoji: string, el: Element | null, fx: ReactionP | null = style) {
  if (!el || !push) return;
  if (document.documentElement.dataset.motion === "reduce") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches && document.documentElement.dataset.motion !== "full") return;
  const r = el.getBoundingClientRect();
  push({ x: r.left + r.width / 2, y: r.top + r.height / 2, emoji, fx });
}

const ease = { duration: 0.9, ease: "easeOut" } as const;

function Classic({ b }: { b: Burst }) {
  return (
    <>
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 9 + (b.id % 3) * 0.3;
        const dist = 48 + (i % 3) * 22;
        return (
          <motion.span
            key={i}
            className="absolute text-xl"
            style={{ left: b.x, top: b.y }}
            initial={{ x: "-50%", y: "-50%", scale: 0.4, opacity: 1 }}
            animate={{
              x: `calc(-50% + ${Math.cos(angle) * dist}px)`,
              y: `calc(-50% + ${Math.sin(angle) * dist - 30}px)`,
              scale: [0.4, 1.3, 0.9],
              opacity: [1, 1, 0],
              rotate: (i % 2 ? 1 : -1) * 90,
            }}
            transition={ease}
          >
            {b.emoji}
          </motion.span>
        );
      })}
    </>
  );
}

const PARTICLE: Partial<Record<ReactionP["burst"], (c: string) => React.CSSProperties>> = {
  burst: (c) => ({ width: 6, height: 6, borderRadius: 9, background: c, boxShadow: `0 0 6px ${c}` }),
  pixel: (c) => ({ width: 6, height: 6, background: c }),
  splash: (c) => ({ width: 7, height: 10, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: c }),
  petals: (c) => ({ width: 10, height: 6, borderRadius: "70% 0", background: c }),
  stars: (c) => ({ width: 8, height: 8, background: c, clipPath: "polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)" }),
  shine: (c) => ({ width: 14, height: 14, background: c, clipPath: "polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%)" }),
  flame: (c) => ({ width: 8, height: 14, borderRadius: "50% 50% 50% 50% / 70% 70% 30% 30%", background: `linear-gradient(${c}, transparent)` }),
  shock: (c) => ({ width: 3, height: 14, background: c, transform: "skewX(-20deg)", boxShadow: `0 0 4px ${c}` }),
};

function Styled({ b, fx }: { b: Burst; fx: ReactionP }) {
  const base = { left: b.x, top: b.y } as const;
  const center = (
    <motion.span className="absolute text-2xl" style={base} initial={{ x: "-50%", y: "-50%", scale: 0.6 }} animate={{ scale: [0.6, 1.35, 1], opacity: [1, 1, 0] }} transition={ease}>
      {b.emoji}
    </motion.span>
  );
  const rings = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <motion.span
        key={`r${i}`}
        className="absolute rounded-full"
        style={{ ...base, width: 20, height: 20, border: `2px solid ${fx.colors[i % fx.colors.length]}` }}
        initial={{ x: "-50%", y: "-50%", scale: 0.4, opacity: 0.9 }}
        animate={{ scale: 4 + i, opacity: 0 }}
        transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }}
      />
    ));
  switch (fx.burst) {
    case "impact":
    case "comic":
      return (
        <>
          {center}
          <motion.span
            className="absolute rounded-md border-2 px-2 py-0.5 text-sm font-black"
            style={{ ...base, background: fx.colors[0], color: fx.colors[1] ?? "#000", borderColor: fx.colors[1] ?? "#000" }}
            initial={{ x: "-50%", y: "-120%", scale: 0.3, rotate: -12, opacity: 1 }}
            animate={{ scale: [0.3, 1.25, 1], y: "-180%", opacity: [1, 1, 0] }}
            transition={{ duration: 0.85, ease: "easeOut" }}
          >
            {fx.text}
          </motion.span>
        </>
      );
    case "heart":
    case "digital":
      return (
        <motion.span
          className="absolute text-4xl font-black"
          style={{ ...base, color: fx.colors[0], textShadow: fx.burst === "heart" ? `0 0 10px ${fx.colors[0]}, 0 0 18px ${fx.colors[1] ?? fx.colors[0]}` : `2px 2px 0 ${fx.colors[1] ?? "#000"}`, fontFamily: fx.burst === "digital" ? "ui-monospace, monospace" : undefined }}
          initial={{ x: "-50%", y: "-50%", scale: 0.3 }}
          animate={{ scale: [0.3, 1.4, 1.1], y: "-110%", opacity: [1, 1, 0] }}
          transition={ease}
        >
          {fx.burst === "digital" ? "▣♥" : "♥"}
        </motion.span>
      );
    case "pulse":
    case "ripple":
    case "prism":
      return <>{center}{rings(fx.count > 3 ? 3 : fx.count)}</>;
    case "glitch":
      return (
        <>
          {fx.colors.concat("#ffffff").map((c, i) => (
            <motion.span key={i} className="absolute text-2xl" style={{ ...base, textShadow: `0 0 0 ${c}`, color: "transparent" }}
              initial={{ x: "-50%", y: "-50%" }} animate={{ x: [`-50%`, `calc(-50% + ${(i - 1) * 6}px)`, "-50%"], opacity: [1, 1, 0] }} transition={{ duration: 0.6, ease: "linear" }}>
              {b.emoji}
            </motion.span>
          ))}
        </>
      );
    case "orbit":
      return (
        <>
          {center}
          {fx.colors.slice(0, 2).map((c, i) => (
            <motion.span key={i} className="absolute rounded-full" style={{ ...base, width: 7, height: 7, background: c, marginLeft: -3.5, marginTop: -3.5 }}
              animate={{ x: [0, 26, 0, -26, 0].map((v) => (i ? -v : v)), y: [-26, 0, 26, 0, -26].map((v) => (i ? -v : v)), opacity: [1, 1, 1, 1, 0] }} transition={{ duration: 0.9, ease: "linear" }} />
          ))}
        </>
      );
    case "shimmer":
      return (
        <>
          {center}
          <motion.span className="absolute h-8 w-3 -skew-x-12" style={{ ...base, marginTop: -16, background: `linear-gradient(90deg, transparent, ${fx.colors[0]}, transparent)` }}
            initial={{ x: -30, opacity: 0.9 }} animate={{ x: 30, opacity: 0 }} transition={{ duration: 0.6 }} />
        </>
      );
    case "trail":
      return (
        <>
          {Array.from({ length: fx.count }, (_, i) => (
            <motion.span key={i} className="absolute text-2xl" style={base} initial={{ x: "-50%", y: "-50%", opacity: 0.8 - i * 0.18 }}
              animate={{ y: `calc(-50% - ${60 - i * 10}px)`, opacity: 0 }} transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }}>
              {b.emoji}
            </motion.span>
          ))}
        </>
      );
    default: {
      const shape = PARTICLE[fx.burst] ?? PARTICLE.burst!;
      return (
        <>
          {center}
          {Array.from({ length: fx.count }, (_, i) => {
            const a = (Math.PI * 2 * i) / fx.count + (b.id % 4) * 0.2;
            const dist = 40 + (i % 3) * 18;
            const fall = fx.burst === "petals" || fx.burst === "splash" ? 30 : fx.burst === "flame" ? -40 : 0;
            return (
              <motion.span
                key={i}
                className="absolute"
                style={{ ...base, ...shape(fx.colors[i % fx.colors.length]) }}
                initial={{ x: "-50%", y: "-50%", scale: 0.5, opacity: 1 }}
                animate={{ x: `calc(-50% + ${Math.cos(a) * dist}px)`, y: `calc(-50% + ${Math.sin(a) * dist + fall}px)`, scale: [0.5, 1.2, 0.8], opacity: [1, 1, 0], rotate: fx.burst === "petals" ? 140 : 0 }}
                transition={ease}
              />
            );
          })}
        </>
      );
    }
  }
}

export function EmojiBurstLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    push = (b) => {
      const id = seq++;
      setBursts((all) => [...all.slice(-6), { ...b, id }]);
      setTimeout(() => setBursts((all) => all.filter((x) => x.id !== id)), 1100);
    };
    return () => {
      push = null;
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]" aria-hidden>
      {bursts.map((b) => (b.fx ? <Styled key={b.id} b={b} fx={b.fx} /> : <Classic key={b.id} b={b} />))}
    </div>,
    document.body,
  );
}
