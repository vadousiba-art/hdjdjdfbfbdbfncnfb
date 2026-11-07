"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { EffectP } from "@/lib/pro/catalog";
import { reducedMotion } from "@/lib/client/pro";

// Interface Effects: one canvas behind everything (pointer-events: none, so
// it never blocks a tap) for ambient particles, and a short overlay for page
// transitions. Off for reduced motion and data saver, paused in background
// tabs, capped at 30 fps, and nothing flashes.

const GLYPHS = "アイウエオカキクケコサシスセソ0123456789夜";
type P = { x: number; y: number; vx: number; vy: number; s: number; c: string; life: number; rot: number; g: string };

function lite() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(c?.saveData);
}

function spawn(e: EffectP, w: number, h: number, fresh: boolean): P {
  const r = Math.random;
  const sp = e.speed * (0.6 + r() * 0.8);
  let x = r() * w;
  let y = r() * h;
  let vx = 0;
  let vy = 0;
  if (e.dir === "down") { vy = sp * 1.2; if (!fresh) y = -20; }
  if (e.dir === "up") { vy = -sp; if (!fresh) y = h + 20; x = r() < 0.5 ? r() * w * 0.25 : w - r() * w * 0.25; }
  if (e.dir === "drift") { vx = sp * 0.6; vy = sp * 0.35; if (!fresh) { x = -20; } }
  if (e.dir === "radial") { const a = r() * Math.PI * 2; vx = Math.cos(a) * sp * 0.3; vy = Math.sin(a) * sp * 0.3; x = w / 2; y = h / 2; }
  const size = e.shape === "smoke" ? 40 + r() * 60 : e.shape === "petal" ? 4 + r() * 3 : e.shape === "glyph" ? 10 + r() * 6 : 1 + r() * 2.2;
  return { x, y, vx, vy, s: size, c: e.colors[Math.floor(r() * e.colors.length)], life: 1, rot: r() * Math.PI, g: GLYPHS[Math.floor(r() * GLYPHS.length)] };
}

function draw(ctx: CanvasRenderingContext2D, e: EffectP, p: P, t: number, w: number, h: number) {
  ctx.globalAlpha = 0.55 * p.life;
  ctx.fillStyle = p.c;
  ctx.strokeStyle = p.c;
  switch (e.shape) {
    case "drop":
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.s * 1.2, p.s * 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "glyph":
      ctx.font = `${p.s}px ui-monospace, monospace`;
      ctx.fillText(p.g, p.x, p.y);
      break;
    case "spark":
      ctx.fillRect(p.x, p.y, p.s, p.s * 3);
      break;
    case "smoke": {
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
      gr.addColorStop(0, p.c);
      gr.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.25 * p.life;
      ctx.fillStyle = gr;
      ctx.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
      break;
    }
    case "star":
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - p.s * 2);
      ctx.lineTo(p.x + p.s * 0.5, p.y);
      ctx.lineTo(p.x, p.y + p.s * 2);
      ctx.lineTo(p.x - p.s * 0.5, p.y);
      ctx.closePath();
      ctx.fill();
      if (e.speed > 1) { ctx.globalAlpha = 0.25 * p.life; ctx.fillRect(p.x - 30, p.y - 1, 30, 1.2); }
      break;
    case "petal":
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + t * 0.0006);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    case "arc": {
      ctx.globalAlpha = 0.5 * Math.max(0, Math.sin(t * 0.002 + p.rot * 5));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let ax = p.x, ay = p.y;
      ctx.moveTo(ax, ay);
      for (let i = 0; i < 4; i++) { ax += 8 + Math.random() * 4; ay += (i % 2 ? 6 : -6); ctx.lineTo(ax, ay); }
      ctx.stroke();
      break;
    }
    case "line":
      ctx.globalAlpha = 0.12 * p.life;
      ctx.fillRect(0, p.y, w, 2);
      break;
    case "pulse": {
      const k = 0.5 + 0.5 * Math.sin(t * 0.001 * e.speed * 3 + p.rot * 3);
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, "transparent");
      gr.addColorStop(1, p.c);
      ctx.globalAlpha = 0.08 + 0.1 * k;
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "ring": {
      const rr = ((t * 0.02 * e.speed + p.rot * 200) % 600) + 10;
      ctx.globalAlpha = 0.15 * (1 - rr / 610);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, rr, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    default:
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
  }
}

export function AmbientEffect({ p, contained }: { p: EffectP; contained?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || p.kind !== "particles" || reducedMotion() || lite()) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const box = contained ? cv.parentElement!.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
      w = box.width; h = box.height;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const n = contained ? Math.ceil(p.count * 0.6) : p.count;
    const parts = Array.from({ length: n }, () => spawn(p, w, h, true));
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // ~30 fps
      const dt = Math.min(3, (t - last) / 16.7);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (p.dir === "radial") q.life -= 0.004 * dt;
        if (p.shape === "line") q.life = 0.5 + 0.5 * Math.sin(t * 0.001 + i);
        if (q.y > h + 30 || q.y < -30 || q.x > w + 30 || q.x < -60 || q.life <= 0) parts[i] = spawn(p, w, h, false);
        draw(ctx, p, q, t, w, h);
      }
    };
    const vis = () => {
      cancelAnimationFrame(raf);
      if (document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    addEventListener("resize", resize);
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [p, contained]);
  if (p.kind !== "particles") return null;
  return <canvas ref={ref} aria-hidden className={contained ? "pointer-events-none absolute inset-0 h-full w-full" : "pointer-events-none fixed inset-0 z-0 h-full w-full"} />;
}

// A page transition, played once per route change (or on demand in previews).
export function TransitionFlash({ p, play }: { p: EffectP; play: number }) {
  const [on, setOn] = useState(0);
  useEffect(() => {
    if (!play || reducedMotion() || lite()) return;
    const start = setTimeout(() => setOn(play), 0);
    const stop = setTimeout(() => setOn(0), 520);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, [play]);
  if (!on || p.kind !== "transition") return null;
  const c = p.colors[0];
  const c2 = p.colors[1] ?? c;
  return (
    <svg key={on} aria-hidden viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="pro-transition pointer-events-none fixed inset-0 z-[80] h-full w-full">
      {p.transition === "speedlines" &&
        Array.from({ length: p.count }, (_, i) => {
          const a = (i / p.count) * Math.PI * 2;
          return <line key={i} x1={50 + Math.cos(a) * 18} y1={50 + Math.sin(a) * 18} x2={50 + Math.cos(a) * 90} y2={50 + Math.sin(a) * 90} stroke={c} strokeWidth={0.4 + (i % 3) * 0.3} strokeOpacity="0.5" />;
        })}
      {p.transition === "shatter" &&
        Array.from({ length: p.count }, (_, i) => {
          const a = (i / p.count) * Math.PI * 2;
          const x = 50 + Math.cos(a) * 25, y = 50 + Math.sin(a) * 25;
          return <polygon key={i} className="pro-shard" style={{ "--dx": `${Math.cos(a) * 40}px`, "--dy": `${Math.sin(a) * 40}px` } as React.CSSProperties}
            points={`${x},${y} ${x + 9},${y + 4} ${x + 2},${y + 10}`} fill={i % 3 ? c : c2} fillOpacity="0.35" />;
        })}
      {p.transition === "eclipse" && <circle className="pro-eclipse" cx="50" cy="50" r="80" fill={c} stroke={c2} strokeWidth="0.6" />}
    </svg>
  );
}

// Plays the equipped transition whenever the route changes.
export function RouteTransition({ p }: { p: EffectP }) {
  const path = usePathname();
  const [n, setN] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setN((x) => x + 1), 0);
    return () => clearTimeout(t);
  }, [path]);
  return <TransitionFlash p={p} play={n} />;
}
