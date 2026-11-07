"use client";

import { useId } from "react";
import clsx from "clsx";
import type { BannerP } from "@/lib/pro/catalog";

// Profile banners: twenty original animated scenes in SVG (no downloads,
// crisp at any width). The 600×200 scene is cropped to fit (slice). Every
// scene loops slowly with layered motion (parallax, weather, light) and stops
// for reduced motion; `still` pauses it until hovered.

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const m = (cls: string, d?: number, delay?: number, origin?: string) => ({
  className: clsx("pr", cls),
  style: { "--d": d ? `${d}s` : undefined, animationDelay: delay ? `${delay}s` : undefined, transformOrigin: origin } as React.CSSProperties,
});

function Skyline({ y, fill, seed, lit, blink }: { y: number; fill: string; seed: number; lit?: string; blink?: boolean }) {
  const r = rand(seed);
  let x = 0;
  const out: React.ReactNode[] = [];
  let n = 0;
  while (x < 600) {
    const w = 18 + r() * 34;
    const h = 30 + r() * 80;
    out.push(<rect key={x} x={x} y={y - h} width={w} height={h + 200} fill={fill} />);
    if (lit)
      for (let wy = y - h + 8; wy < y - 4; wy += 9)
        for (let wx = x + 4; wx < x + w - 4; wx += 7)
          if (r() > 0.72) {
            n++;
            const tw = blink && n % 7 === 0;
            out.push(<rect key={`${wx}-${wy}`} {...(tw ? m("a-fade", 3 + (n % 5), (n % 9) * 0.6) : {})} x={wx} y={wy} width="2.6" height="3.4" fill={lit} opacity={0.5 + r() * 0.5} />);
          }
    x += w + 1;
  }
  return <>{out}</>;
}

// Polyline helpers for scenes with current flowing along wires: the path and
// its length (the flow animation needs the length to loop without a seam).
type Pt = readonly [number, number];
const poly = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const polyLen = (pts: Pt[]) => pts.slice(1).reduce((n, [x, y], i) => n + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);
// A wire hanging between two points (a parabola is close enough to a catenary).
function sag(x1: number, y1: number, x2: number, y2: number, drop: number, n = 18): Pt[] {
  return range(n + 1).map((i) => {
    const t = i / n;
    return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + drop * 4 * t * (1 - t)] as const;
  });
}
function Pylon({ x, top, base, w, arms }: { x: number; top: number; base: number; w: number; arms: number[] }) {
  const h = base - top;
  const at = (y: number) => (w / 2) * ((y - top) / h) + 2; // half-width at height y
  const rungs = range(7).map((i) => top + 8 + (i * (h - 8)) / 6);
  return (
    <g stroke="#3d2b73" strokeWidth="1.1" fill="none">
      <path d={`M${x - 2},${top} L${x - w / 2 - 2},${base} M${x + 2},${top} L${x + w / 2 + 2},${base}`} stroke="#4a3590" strokeWidth="1.6" />
      {rungs.map((y, i) => <line key={i} x1={x - at(y)} y1={y} x2={x + at(y)} y2={y} />)}
      {rungs.slice(0, -1).map((y, i) => (
        <path key={`x${i}`} d={`M${x - at(y)},${y} L${x + at(rungs[i + 1])},${rungs[i + 1]} M${x + at(y)},${y} L${x - at(rungs[i + 1])},${rungs[i + 1]}`} strokeOpacity="0.7" />
      ))}
      {arms.map((y, i) => {
        const reach = w * (0.75 - i * 0.12);
        return (
          <g key={`a${i}`}>
            <path d={`M${x - reach},${y} L${x + reach},${y} M${x - reach},${y} L${x - at(y + 6)},${y + 6} M${x + reach},${y} L${x + at(y + 6)},${y + 6}`} stroke="#4a3590" strokeWidth="1.3" />
            <circle cx={x - reach} cy={y + 2} r="1.4" fill="#8b5cff" stroke="none" />
            <circle cx={x + reach} cy={y + 2} r="1.4" fill="#8b5cff" stroke="none" />
          </g>
        );
      })}
    </g>
  );
}

function Stars({ n, seed, color = "#fff", h = 200, twinkle = true }: { n: number; seed: number; color?: string; h?: number; twinkle?: boolean }) {
  const r = rand(seed);
  return (
    <>
      {range(n).map((i) => {
        const big = r() > 0.85;
        return (
          <circle key={i} {...(twinkle && i % 3 === 0 ? m("a-twinkle", 2 + r() * 3, r() * 3) : {})} cx={r() * 600} cy={r() * h} r={big ? 1.4 : 0.3 + r() * 0.8} fill={color} opacity={0.3 + r() * 0.7} />
        );
      })}
    </>
  );
}

function Rain({ n, seed, color, len = 16, d = 1.4 }: { n: number; seed: number; color: string; len?: number; d?: number }) {
  const r = rand(seed);
  return (
    <>
      {[0, 1].map((layer) => (
        <g key={layer} {...m("pro-rain", d + layer * 0.5, layer * 0.3)} opacity={layer ? 0.5 : 0.9}>
          {range(n / 2).map((i) => {
            const x = r() * 640;
            const y = r() * 220 - 20;
            return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + len - layer * 5} stroke={color} strokeWidth={layer ? 0.7 : 1} opacity={0.3 + r() * 0.6} />;
          })}
        </g>
      ))}
    </>
  );
}

function Fog({ y, color, opacity = 0.12, d = 14 }: { y: number; color: string; opacity?: number; d?: number }) {
  return (
    <g {...m("a-drift", d)}>
      <ellipse cx="160" cy={y} rx="220" ry="26" fill={color} opacity={opacity} style={{ filter: "blur(8px)" }} />
      <ellipse cx="470" cy={y + 8} rx="200" ry="22" fill={color} opacity={opacity * 0.8} style={{ filter: "blur(8px)" }} />
    </g>
  );
}

function Petals({ n, seed, color, d = 7 }: { n: number; seed: number; color: string; d?: number }) {
  const r = rand(seed);
  return (
    <>
      {range(n).map((i) => {
        const x = 20 + r() * 560;
        const y = r() * 120;
        return (
          <g key={i} {...m("a-fall", d + r() * 4, r() * d)}>
            <ellipse {...m("a-sway", 2 + r() * 2)} cx={x} cy={y} rx="5" ry="2.8" fill={color} opacity="0.85" />
          </g>
        );
      })}
    </>
  );
}

function Scene({ scene, uid }: { scene: string; uid: string }) {
  const g = (n: string) => `${uid}${n}`;
  switch (scene) {
    case "afterdark":
      return (
        <>
          <defs>
            <linearGradient id={g("s")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0a0a0a" />
              <stop offset="1" stopColor="#1a0408" />
            </linearGradient>
            <linearGradient id={g("l")} x1="0" x2="1">
              <stop offset="0" stopColor="#e5102f" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ff6b81" />
              <stop offset="1" stopColor="#e5102f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" fill={`url(#${g("s")})`} />
          <Stars n={30} seed={31} h={130} />
          <rect {...m("a-breathe", 4)} y="148" width="600" height="6" fill="#e5102f" opacity="0.35" style={{ filter: "blur(3px)" }} />
          <rect y="150" width="600" height="2" fill="#e5102f" />
          <rect {...m("a-slide", 7)} x="0" y="149.5" width="220" height="3" fill={`url(#${g("l")})`} />
          <rect y="152" width="600" height="48" fill="#050505" />
          <text {...m("a-bob", 6)} x="560" y="140" fontSize="64" fill="#fff" opacity="0.06" fontWeight="900" textAnchor="end">夜</text>
        </>
      );
    case "crimson_rain":
      return (
        <>
          <rect width="600" height="200" fill="#120205" />
          <circle {...m("a-breathe", 5)} cx="470" cy="70" r="46" fill="#e5102f" opacity="0.25" />
          <Skyline y={170} fill="#050102" seed={5} lit="#ff4d6a" blink />
          <Rain n={90} seed={3} color="#ff3b4e" />
        </>
      );
    case "neon_tokyo":
      return (
        <>
          <rect width="600" height="200" fill="#07040f" />
          <Skyline y={150} fill="#120a24" seed={9} lit="#28f0ff" blink />
          {[["#ff2bd6", 60, "夜"], ["#28f0ff", 190, "東京"], ["#ffd23f", 330, "酒"], ["#ff2bd6", 470, "ネオン"]].map(([c, x, t], i) => (
            <g key={i} {...m(i % 2 ? "a-flick" : "a-fade", 4 + i, i * 0.7)}>
              <rect x={Number(x)} y={40 + (i % 2) * 22} width={String(t).length * 20 + 14} height="34" rx="4" fill="none" stroke={String(c)} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
              <text x={Number(x) + 7} y={64 + (i % 2) * 22} fontSize="20" fill={String(c)} fontWeight="700" style={{ filter: `drop-shadow(0 0 3px ${c})` }}>{t}</text>
            </g>
          ))}
          <rect y="165" width="600" height="35" fill="#0b0618" />
          <g {...m("a-fade", 3)}>
            <rect y="165" width="600" height="35" fill="#ff2bd6" opacity="0.1" />
            {[80, 220, 360, 500].map((x, i) => <rect key={x} x={x} y="168" width="24" height="30" fill={i % 2 ? "#28f0ff" : "#ff2bd6"} opacity="0.12" style={{ filter: "blur(4px)" }} />)}
          </g>
          <Rain n={40} seed={4} color="#9fdcff" len={10} d={1.1} />
        </>
      );
    case "station": {
      const r = rand(17);
      return (
        <>
          <rect width="600" height="200" fill="#0b0b0b" />
          <polygon points="0,200 600,200 420,120 180,120" fill="#151515" />
          <rect x="0" y="118" width="600" height="3" fill="#2a2a2a" />
          {range(6).map((i) => <rect key={i} x={110 + i * 80} y="30" width="6" height="90" fill="#1d1d1d" />)}
          <g {...m("a-flick", 2.6)}>
            <rect x="268" y="18" width="64" height="5" fill="#e8e8e8" />
            <polygon points="270,23 330,23 380,200 220,200" fill="#ffffff" opacity="0.06" />
          </g>
          {range(14).map((i) => <circle key={i} {...m("a-rise", 4 + r() * 3, r() * 4)} cx={240 + r() * 120} cy={60 + r() * 120} r={0.6 + r() * 0.8} fill="#fff" opacity="0.5" />)}
          <rect x="290" y="135" width="6" height="40" fill="#2b2b2b" />
          <circle cx="293" cy="130" r="5" fill="#2b2b2b" />
          <g {...m("a-slide", 11, 3)}>
            <rect x="-60" y="100" width="40" height="3" fill="#fff" opacity="0.6" style={{ filter: "blur(2px)" }} />
          </g>
        </>
      );
    }
    case "skyline":
      return (
        <>
          <defs>
            <linearGradient id={g("k")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#050a1c" />
              <stop offset="1" stopColor="#122046" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" fill={`url(#${g("k")})`} />
          <Stars n={50} seed={4} h={90} />
          <g {...m("a-drift", 20)}>
            <ellipse cx="200" cy="60" rx="90" ry="8" fill="#1f2c55" opacity="0.6" />
            <ellipse cx="460" cy="40" rx="70" ry="6" fill="#1f2c55" opacity="0.5" />
          </g>
          <Skyline y={150} fill="#070b17" seed={12} lit="#ffd27a" blink />
          <g {...m("a-fade", 1.8)}><circle cx="388" cy="70" r="1.6" fill="#ff3b4e" /></g>
          <rect y="185" width="600" height="15" fill="#05070f" />
        </>
      );
    case "impact":
      return (
        <>
          <rect width="600" height="200" fill="#f4f2ee" />
          <g {...m("a-rot", 60, 0, "300px 100px")} style={{ transformBox: "view-box", transformOrigin: "300px 100px", "--d": "60s" } as React.CSSProperties}>
            {range(60).map((i) => {
              const a = (i / 60) * Math.PI * 2;
              return <polygon key={i} points={`300,100 ${300 + Math.cos(a) * 700},${100 + Math.sin(a) * 700} ${300 + Math.cos(a + 0.03) * 700},${100 + Math.sin(a + 0.03) * 700}`} fill="#0a0a0a" />;
            })}
          </g>
          <g {...m("a-pop", 2.4)}>
            <polygon points="300,40 318,78 360,60 336,96 380,112 330,118 344,160 306,128 276,166 278,124 228,128 262,98 226,66 270,76" fill="#e5102f" stroke="#0a0a0a" strokeWidth="4" />
            <text x="300" y="110" fontSize="26" fontWeight="900" fill="#fff" textAnchor="middle" stroke="#0a0a0a" strokeWidth="1">ドン</text>
          </g>
        </>
      );
    case "abyss":
      return (
        <>
          <rect width="600" height="200" fill="#07050d" />
          <radialGradient id={g("v")} cx="50%" cy="38%" r="40%">
            <stop offset="0" stopColor="#7c5cff" stopOpacity="0.6" />
            <stop offset="1" stopColor="#07050d" stopOpacity="0" />
          </radialGradient>
          <rect {...m("a-breathe", 4)} width="600" height="200" fill={`url(#${g("v")})`} />
          <g className="pro-scroll-y" stroke="#7c5cff" strokeOpacity="0.55" strokeWidth="1">
            {range(13).map((i) => <line key={i} x1="300" y1="76" x2={-300 + i * 100} y2="220" />)}
            {range(8).map((i) => {
              const y = 80 + Math.pow(i / 7, 2) * 140;
              return <line key={`h${i}`} x1="0" y1={y} x2="600" y2={y} />;
            })}
          </g>
          {range(6).map((i) => <rect key={i} {...m("a-rise", 3 + i * 0.4, i * 0.6)} x={260 + i * 15} y={120} width="2" height="2" fill="#2ee6ff" />)}
        </>
      );
    case "shrine":
      return (
        <>
          <rect width="600" height="200" fill="#06070c" />
          <Stars n={25} seed={8} h={110} />
          <circle {...m("a-breathe", 5)} cx="300" cy="96" r="92" fill="#e9edf5" opacity="0.08" />
          <circle cx="300" cy="96" r="74" fill="#e9edf5" />
          <g fill="#090a10">
            <rect x="205" y="58" width="190" height="12" rx="3" />
            <rect x="196" y="50" width="208" height="10" rx="4" />
            <rect x="222" y="82" width="156" height="8" />
            <rect x="232" y="60" width="12" height="140" />
            <rect x="356" y="60" width="12" height="140" />
          </g>
          <Fog y={170} color="#c9d1e0" opacity={0.14} />
          <Petals n={7} seed={22} color="#ffb7cf" />
          <rect y="182" width="600" height="18" fill="#090a10" />
        </>
      );
    case "cathedral":
      return (
        <>
          <rect width="600" height="200" fill="#08060f" />
          <g className="pro-scan">
            {range(7).map((i) => {
              const x = 30 + i * 85;
              return (
                <g key={i} {...m("a-glitch", 3 + (i % 3) * 0.7, i * 0.3)}>
                  <path d={`M${x},200 L${x},80 Q${x + 30},20 ${x + 60},80 L${x + 60},200`} fill="none" stroke={i % 2 ? "#7c5cff" : "#2ee6ff"} strokeWidth="2" />
                  <circle {...m("a-fade", 2.5, i * 0.4)} cx={x + 30} cy="70" r="10" fill="none" stroke="#ff3b6b" strokeWidth="1.5" />
                </g>
              );
            })}
          </g>
          {range(50).map((i) => <rect key={i} y={i * 4} width="600" height="1" fill="#000" opacity="0.35" />)}
          <rect {...m("a-slide", 5)} x="0" y="0" width="30" height="200" fill="#2ee6ff" opacity="0.06" />
        </>
      );
    case "horizon":
      return (
        <>
          <defs>
            <linearGradient id={g("h")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14020a" />
              <stop offset="1" stopColor="#4a0714" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" fill={`url(#${g("h")})`} />
          <circle {...m("a-breathe", 6)} cx="300" cy="140" r="78" fill="#e5102f" opacity="0.2" />
          <circle cx="300" cy="140" r="60" fill="#e5102f" />
          {range(5).map((i) => <rect key={i} {...m("a-drift", 6 + i)} x="230" y={118 + i * 9} width="140" height={2 + i} fill="#14020a" />)}
          <g {...m("a-drift", 18)}>
            {[[140, 70], [160, 64], [176, 72]].map(([x, y], i) => <path key={i} {...m("a-bob", 1.4, i * 0.3)} d={`M${x},${y} q4,-4 8,0 q4,-4 8,0`} fill="none" stroke="#14020a" strokeWidth="1.6" />)}
          </g>
          <path d="M0,160 Q120,120 240,158 T480,150 T600,140 L600,200 L0,200z" fill="#0c0105" />
          <path d="M0,180 Q150,150 300,178 T600,170 L600,200 L0,200z" fill="#050002" />
        </>
      );
    case "blackout":
      return (
        <>
          <defs>
            <linearGradient id={g("gl")} x1="0" x2="1">
              <stop offset="0" stopColor="#fff6d6" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff6d6" />
              <stop offset="1" stopColor="#fff6d6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" fill="#050505" />
          {range(14).map((i) => <polygon key={i} points={`${i * 46},0 ${i * 46 + 46},0 ${i * 46 + 23},40`} fill="#0e0e0e" stroke="#1a1a1a" />)}
          {range(14).map((i) => <polygon key={`b${i}`} points={`${i * 46 - 23},200 ${i * 46 + 23},200 ${i * 46},160`} fill="#0e0e0e" stroke="#1a1a1a" />)}
          <rect y="99" width="600" height="2" fill="#c8a24a" />
          <rect {...m("a-slide", 6)} y="98" width="200" height="4" fill={`url(#${g("gl")})`} />
          <g {...m("a-rot", 20, 0)} style={{ transformBox: "fill-box", transformOrigin: "center", "--d": "20s" } as React.CSSProperties}>
            <rect x="285" y="88" width="30" height="24" fill="#050505" stroke="#c8a24a" strokeWidth="1.5" transform="rotate(45 300 100)" />
          </g>
          <circle {...m("a-twinkle", 3)} cx="300" cy="100" r="2" fill="#fff6d6" />
        </>
      );
    case "alley": {
      const r = rand(8);
      return (
        <>
          <rect width="600" height="200" fill="#08060f" />
          <polygon points="0,0 230,40 230,200 0,200" fill="#120d1f" />
          <polygon points="600,0 370,40 370,200 600,200" fill="#120d1f" />
          {range(10).map((i) => (
            <rect key={i} {...m(i % 3 ? "a-fade" : "a-flick", 2.5 + (i % 4), i * 0.4)} x={i < 5 ? 20 + i * 40 : 400 + (i - 5) * 38} y={30 + r() * 100} width={18 + r() * 14} height="12"
              fill={["#39ff88", "#ffd23f", "#ff3b6b"][i % 3]} opacity="0.85" />
          ))}
          <rect x="230" y="40" width="140" height="160" fill="#05040a" />
          <rect {...m("a-fade", 2)} x="228" y="150" width="144" height="4" fill="#39ff88" opacity="0.4" />
          <Fog y={190} color="#39ff88" opacity={0.06} d={10} />
          <Rain n={30} seed={12} color="#39ff88" len={8} d={1.3} />
        </>
      );
    }
    case "collapse":
      return (
        <>
          <rect width="600" height="200" fill="#03030a" />
          <Stars n={60} seed={2} />
          <g {...m("a-bob", 6)}>
            <circle cx="300" cy="110" r="50" fill="#5b6cff" />
            <circle cx="285" cy="98" r="50" fill="#03030a" opacity="0.35" />
            <ellipse cx="300" cy="110" rx="110" ry="18" fill="none" stroke="#e9e6ff" strokeWidth="3" transform="rotate(-12 300 110)" />
          </g>
          {[[420, 60, 10], [450, 90, 6], [180, 150, 8], [140, 120, 5], [470, 140, 4], [210, 50, 6]].map(([x, y, s], i) => (
            <g key={i} {...m("a-drift", 8 + i * 2, i)}>
              <polygon {...m("a-rot", 6 + i * 2)} points={`${x},${y} ${x + s},${y + s / 2} ${x + s / 3},${y + s}`} fill="#9aa7ff" />
            </g>
          ))}
        </>
      );
    case "shattered":
      return (
        <>
          <rect width="600" height="200" fill="#0a0a0a" />
          {[
            ["0,0 220,0 180,120 0,90", "#1b1030"], ["220,0 420,0 360,90 180,120", "#2a0207"], ["420,0 600,0 600,110 360,90", "#061a24"],
            ["0,90 180,120 140,200 0,200", "#0b2a17"], ["180,120 360,90 420,200 140,200", "#1a1408"], ["360,90 600,110 600,200 420,200", "#160d22"],
          ].map(([pts, c], i) => <polygon key={i} {...m("a-fade", 4 + i, i * 0.6)} points={pts} fill={c} stroke="#f4f2ee" strokeWidth="4" />)}
          <circle {...m("a-breathe", 4)} cx="90" cy="45" r="16" fill="#e9edf5" />
          <circle {...m("a-breathe", 3, 1)} cx="300" cy="50" r="12" fill="#e5102f" />
          <Stars n={20} seed={6} h={90} />
          <g {...m("a-glitch", 3.5)}><polyline points="180,120 200,104 214,126 236,110" fill="none" stroke="#fff" strokeWidth="1.5" /></g>
        </>
      );
    case "phantom":
      return (
        <>
          <rect width="600" height="200" fill="#0c0d0f" />
          <g {...m("a-fade", 6)}><Skyline y={160} fill="#202328" seed={14} /></g>
          <rect width="600" height="200" fill="#c9ced6" opacity="0.08" />
          <Fog y={120} color="#d9d9d9" opacity={0.1} d={16} />
          <Skyline y={180} fill="#15171a" seed={15} />
          <Fog y={170} color="#d9d9d9" opacity={0.14} d={11} />
        </>
      );
    case "violet_static": {
      const r = rand(13);
      return (
        <>
          <rect width="600" height="200" fill="#120a1c" />
          {[0, 1].map((k) => (
            <g key={k} {...m("a-fade", 0.9 + k * 0.4, k * 0.3)}>
              {range(200).map((i) => <rect key={i} x={r() * 600} y={r() * 200} width="1.5" height="1.5" fill="#c48cff" opacity={r() * 0.45} />)}
            </g>
          ))}
          <Petals n={10} seed={41} color="#ff8fb4" d={8} />
        </>
      );
    }
    case "train":
      return (
        <>
          <rect width="600" height="200" fill="#060814" />
          <Stars n={30} seed={7} h={80} />
          <rect y="120" width="600" height="6" fill="#141a2e" />
          {range(9).map((i) => <rect key={i} x={i * 70 + 20} y="126" width="8" height="80" fill="#0e1222" />)}
          <g {...m("a-slide", 12)}>
            <rect x="90" y="92" width="420" height="28" rx="6" fill="#151b33" />
            {range(14).map((i) => <rect key={`w${i}`} x={100 + i * 29} y="98" width="20" height="12" rx="2" fill="#ffd27a" opacity="0.9" />)}
            <rect x="90" y="120" width="420" height="3" fill="#ff2bd6" opacity="0.6" />
            <rect x="505" y="100" width="18" height="6" fill="#fff" opacity="0.8" style={{ filter: "blur(2px)" }} />
          </g>
        </>
      );
    case "inkstorm": {
      const strokes = [
        "M-20,150 C80,40 220,180 330,80 S520,20 640,110",
        "M-20,60 C100,120 200,10 320,70 S500,170 640,60",
        "M-20,190 C120,150 260,200 380,150 S560,120 640,170",
      ];
      return (
        <>
          <rect width="600" height="200" fill="#f4f2ee" />
          {strokes.map((d, i) => <path key={i} {...m("a-breathe", 5 + i, i)} d={d} fill="none" stroke="#0a0a0a" strokeWidth={26 - i * 6} strokeLinecap="round" opacity={0.92 - i * 0.15} />)}
          <path {...m("a-dash", 4)} d="M380,40 C430,30 470,70 520,50" fill="none" stroke="#e5102f" strokeWidth="9" strokeLinecap="round" strokeDasharray="160 120" />
          {[[120, 40, 6], [140, 28, 3], [480, 150, 4], [520, 170, 2.5]].map(([x, y, rr], i) => <circle key={i} {...m("a-pop", 3, i * 0.5)} cx={x} cy={y} r={rr} fill="#0a0a0a" />)}
        </>
      );
    }
    case "eclipse":
      return (
        <>
          <rect width="600" height="200" fill="#04050a" />
          <Stars n={25} seed={19} h={120} />
          <circle {...m("a-breathe", 5)} cx="300" cy="80" r="56" fill="#d8dde6" opacity="0.15" />
          <circle cx="300" cy="80" r="44" fill="#000" stroke="#e6ebf2" strokeWidth="2" style={{ filter: "drop-shadow(0 0 10px #c9d1e0)" }} />
          <rect y="140" width="600" height="60" fill="#070a12" />
          <ellipse {...m("a-breathe", 4, 1)} cx="300" cy="160" rx="40" ry="5" fill="#e6ebf2" opacity="0.25" />
          {range(6).map((i) => <rect key={i} {...m("a-drift", 5 + i)} x={260 + i * 3} y={150 + i * 7} width={80 - i * 6} height="1" fill="#e6ebf2" opacity={0.2 - i * 0.03} />)}
        </>
      );
    case "nightfall":
      return (
        <>
          <rect width="600" height="200" fill="#03030a" />
          <Stars n={120} seed={1} />
          <g className="pro-aurora">
            <path d="M-20,90 C120,30 240,120 360,60 S560,40 640,80 L640,120 C520,90 420,150 300,110 S80,80 -20,130z" fill="#39ffb0" opacity="0.18" />
            <path d="M-20,70 C140,40 260,90 380,50 S560,60 640,40 L640,70 C520,90 400,80 300,90 S100,60 -20,100z" fill="#7c5cff" opacity="0.2" />
          </g>
          <g {...m("a-shoot", 6)} style={{ "--d": "6s" } as React.CSSProperties}>
            <line x1="430" y1="30" x2="480" y2="5" stroke="#f3e2a9" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="430" cy="30" r="2" fill="#fff6d6" />
          </g>
        </>
      );
    // FOUNDER ONLY. A crimson-gold moon behind a throne, two searchlights
    // crossing the sky, crimson curtains swaying, gold embers rising and a
    // glowing 創 (to found).
    case "throne": {
      const r = rand(77);
      return (
        <>
          <defs>
            <radialGradient id={g("m")} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#ffe6a8" />
              <stop offset="0.55" stopColor="#e0b54f" />
              <stop offset="1" stopColor="#8a1a1a" />
            </radialGradient>
            <linearGradient id={g("beam")} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#fff1c9" stopOpacity="0.5" />
              <stop offset="1" stopColor="#fff1c9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="600" height="200" fill="#050403" />
          <Stars n={50} seed={71} h={140} color="#fff1c9" />
          <g {...m("a-sway", 7, 0, "120px 200px")} style={{ transformBox: "view-box", transformOrigin: "120px 200px", "--d": "7s" } as React.CSSProperties}>
            <polygon points="110,200 135,200 60,-20 30,-20" fill={`url(#${g("beam")})`} />
          </g>
          <g {...m("a-sway", 8, 1.5)} style={{ transformBox: "view-box", transformOrigin: "480px 200px", "--d": "8s", animationDelay: "-3s" } as React.CSSProperties}>
            <polygon points="465,200 490,200 570,-20 540,-20" fill={`url(#${g("beam")})`} />
          </g>
          <circle {...m("a-breathe", 5)} cx="300" cy="86" r="86" fill="#e0b54f" opacity="0.12" />
          <circle cx="300" cy="86" r="64" fill={`url(#${g("m")})`} />
          <text {...m("a-fade", 4)} x="300" y="108" fontSize="62" fontWeight="900" textAnchor="middle" fill="#3a0710" opacity="0.55">創</text>
          <g fill="#0a0705">
            <path d="M240,200 L240,120 Q240,96 262,92 L262,74 Q300,40 338,74 L338,92 Q360,96 360,120 L360,200 Z" />
            <rect x="228" y="150" width="144" height="10" rx="3" />
            <path d="M272,74 L280,58 L290,70 L300,52 L310,70 L320,58 L328,74 Z" fill="#b8902f" />
          </g>
          <circle {...m("a-twinkle", 2.4)} cx="300" cy="52" r="2.5" fill="#e5102f" />
          <path {...m("a-sway", 6)} d="M0,0 L70,0 Q60,90 82,200 L0,200 Z" fill="#5a0612" opacity="0.92" />
          <path {...m("a-sway", 6.5, 1)} d="M600,0 L530,0 Q540,90 518,200 L600,200 Z" fill="#5a0612" opacity="0.92" />
          <rect y="0" width="600" height="8" fill="#b8902f" opacity="0.85" />
          {range(18).map((i) => <circle key={i} {...m("a-rise", 3 + r() * 3, r() * 4)} cx={120 + r() * 360} cy={150 + r() * 50} r={0.8 + r() * 1.4} fill={i % 4 ? "#e0b54f" : "#e5102f"} />)}
        </>
      );
    }
    // ADMINS. A watchtower over the city: its radar sweeps, a beacon blinks,
    // patrol lights cross the grid and data streams run up the tower.
    case "watch": {
      const r = rand(91);
      return (
        <>
          <defs>
            <radialGradient id={g("rad")} cx="50%" cy="100%" r="100%">
              <stop offset="0" stopColor="#2ee6ff" stopOpacity="0.35" />
              <stop offset="1" stopColor="#2ee6ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="600" height="200" fill="#03080d" />
          <Stars n={30} seed={92} h={100} color="#e9f8ff" />
          <g stroke="#2ee6ff" strokeOpacity="0.16" strokeWidth="0.8">
            {range(10).map((i) => <line key={i} x1="0" y1={110 + i * 10} x2="600" y2={110 + i * 10} />)}
            {range(16).map((i) => <line key={`v${i}`} x1={300} y1="110" x2={-300 + i * 80} y2="210" />)}
          </g>
          <g {...m("a-rot", 6)} style={{ transformBox: "view-box", transformOrigin: "300px 62px", "--d": "6s" } as React.CSSProperties}>
            <path d="M300,62 L560,-20 A280,280 0 0,1 600,60 Z" fill={`url(#${g("rad")})`} />
          </g>
          {[0, 1].map((i) => <circle key={i} {...m("a-ripple", 3, i * 1.5)} cx="300" cy="62" r="60" fill="none" stroke="#2ee6ff" strokeWidth="1" />)}
          <Skyline y={175} fill="#07121b" seed={93} lit="#2ee6ff" blink />
          <g fill="#0c1b26" stroke="#2ee6ff" strokeOpacity="0.5">
            <polygon points="290,200 296,80 304,80 310,200" />
            <rect x="284" y="66" width="32" height="14" rx="2" />
          </g>
          {range(4).map((i) => <rect key={i} {...m("a-fall", 1.6, i * 0.4)} x={298} y={90 + i * 22} width="4" height="8" fill="#2ee6ff" opacity="0.8" style={{ animationDirection: "reverse" }} />)}
          <circle {...m("a-flick", 2)} cx="300" cy="62" r="4" fill="#ff3b4e" style={{ filter: "drop-shadow(0 0 4px #ff3b4e)" }} />
          {range(3).map((i) => (
            <g key={`d${i}`} {...m("a-slide", 9 + i * 3, i * 2.5)}>
              <circle cx={-40} cy={120 + i * 20 + r() * 6} r="1.8" fill="#9ff3ff" style={{ filter: "drop-shadow(0 0 3px #2ee6ff)" }} />
            </g>
          ))}
        </>
      );
    }
    // CO-FOUNDER ONLY. A storm over the grid: lightning strikes the pylon and
    // lights the sky (one smooth swell, never a strobe), current runs down the
    // power lines and across a circuit-board ground, pixel invaders drift by,
    // and a terminal types out the build. Jesse is an electrician and a
    // developer; 共 (together) is the co-founder's mark.
    case "voltage": {
      const r = rand(2007);
      const VOLT = "#ffd60a";
      const VIOLET = "#8b5cff";
      const HOT = "#fffbe0";
      const flow = (pts: Pt[], d: number, delay: number, dash = 10, width = 1.4) => {
        const len = polyLen(pts);
        return (
          <path className="pr a-flow" d={poly(pts)} fill="none" stroke={VOLT} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${dash} ${(len - dash).toFixed(1)}`}
            style={{ "--len": len.toFixed(1), "--d": `${d}s`, animationDelay: `${-delay}s`, filter: `drop-shadow(0 0 2px ${VOLT})` } as React.CSSProperties} />
        );
      };
      // Big pylon at x=455 (arms at 86 and 102), small one at x=150 (arms at 118 and 128),
      // on the left where the avatar overlaps the banner; the terminal sits in the middle.
      const wires: Pt[][] = [
        [...sag(-20, 104, 150 - 33, 120, 14), ...sag(150 - 33, 120, 455 - 50, 88, 30).slice(1), ...sag(455 - 50, 88, 640, 98, 18).slice(1)],
        [...sag(-20, 116, 150 + 33, 120, 16), ...sag(150 + 33, 120, 455 + 50, 88, 28).slice(1), ...sag(455 + 50, 88, 640, 110, 14).slice(1)],
        [...sag(-20, 126, 150 - 26, 130, 12), ...sag(150 - 26, 130, 455 - 40, 104, 26).slice(1), ...sag(455 - 40, 104, 640, 122, 16).slice(1)],
      ];
      const traces: Pt[][] = range(7).map((k) => {
        const x0 = -30 + k * 96 + r() * 20;
        const y0 = 176 + (k % 3) * 8;
        const up = k % 2 ? -6 : 6;
        return [[x0, y0], [x0 + 34, y0], [x0 + 40, y0 + up], [x0 + 92, y0 + up], [x0 + 98, y0]] as Pt[];
      });
      const bolt = (pts: Pt[]) => poly(pts);
      const main: Pt[] = [[478, -6], [468, 14], [474, 22], [460, 38], [466, 46], [452, 62], [455, 72]];
      const branch: Pt[] = [[466, 46], [486, 56], [482, 64], [496, 74]];
      const far: Pt[] = [[96, -6], [104, 12], [98, 20], [110, 36], [104, 44], [114, 58]];
      const code: [string, string][] = [
        ["$", "whoami"],
        [" ", "jesse · co-founder · 共同創設者"],
        [">", "power.on(\"⚡\")        ✓"],
        [">", "wire(panel, 240V)      ✓"],
        [">", "npm run build"],
        [" ", "compiling the night… done"],
        [">", "deploy --prod          ✓"],
        ["//", "built together. 共"],
        [">", "while (night) build()"],
      ];
      const LH = 10;
      const block = code.length * LH;
      const invader = ["..X...X..", "...X.X...", "..XXXXX..", ".XX.X.XX.", "XXXXXXXXX", "X.XXXXX.X", "X.X...X.X"];
      const sprite = (c: number) =>
        invader.flatMap((row, y) => [...row].map((ch, x) => (ch === "X" ? <rect key={`${x}-${y}`} x={x * c} y={y * c} width={c + 0.1} height={c + 0.1} /> : null)));
      return (
        <>
          <defs>
            <linearGradient id={g("sky")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#030109" />
              <stop offset="0.7" stopColor="#140a2c" />
              <stop offset="1" stopColor="#1d0f3d" />
            </linearGradient>
            <radialGradient id={g("glow")} cx="78%" cy="20%" r="60%">
              <stop offset="0" stopColor="#c9b6ff" stopOpacity="0.45" />
              <stop offset="0.5" stopColor={VIOLET} stopOpacity="0.16" />
              <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g("glow2")} cx="18%" cy="15%" r="40%">
              <stop offset="0" stopColor="#c9b6ff" stopOpacity="0.3" />
              <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
            </radialGradient>
            <clipPath id={g("term")}><rect x="236" y="66" width="176" height="70" /></clipPath>
          </defs>
          <rect width="600" height="200" fill={`url(#${g("sky")})`} />
          <Stars n={40} seed={2008} h={110} color="#e9e2ff" />
          <rect className="pr a-zap" width="600" height="200" fill={`url(#${g("glow")})`} style={{ "--d": "5s" } as React.CSSProperties} />
          <rect className="pr a-zap" width="600" height="200" fill={`url(#${g("glow2")})`} style={{ "--d": "7s", animationDelay: "2.5s" } as React.CSSProperties} />
          <g {...m("a-drift", 22)} fill="#1a1036">
            {[[60, 18, 70], [170, 8, 90], [300, 20, 80], [420, 6, 100], [560, 16, 80]].map(([x, y, w], i) => (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={w} ry="16" />
                <ellipse cx={x + w * 0.4} cy={y + 8} rx={w * 0.7} ry="14" fill="#140c2b" />
              </g>
            ))}
          </g>
          <g {...m("a-drift", 30)} fill="#22154a" opacity="0.7">
            {[[120, 30, 60], [380, 28, 70], [520, 34, 50]].map(([x, y, w], i) => <ellipse key={i} cx={x} cy={y} rx={w} ry="10" />)}
          </g>
          <g className="pr a-zap" style={{ "--d": "7s", animationDelay: "2.5s" } as React.CSSProperties}>
            <path d={bolt(far)} fill="none" stroke={VIOLET} strokeWidth="3" opacity="0.5" style={{ filter: "blur(1.5px)" }} />
            <path d={bolt(far)} fill="none" stroke="#e9e2ff" strokeWidth="0.9" />
          </g>
          <Skyline y={168} fill="#0b0716" seed={2009} lit="#8b5cff" blink />
          <text {...m("a-fade", 6)} x="552" y="150" fontSize="54" fontWeight="900" textAnchor="middle" fill={VIOLET} opacity="0.3">共</text>
          <Pylon x={150} top={112} base={176} w={34} arms={[118, 128]} />
          {wires.map((w, i) => <path key={`w${i}`} d={poly(w)} fill="none" stroke="#3a2a66" strokeWidth="1" />)}
          {wires.map((w, i) => <g key={`f${i}`}>{flow(w, 3.4 + i * 0.6, i * 1.1, 14)}{flow(w, 3.4 + i * 0.6, i * 1.1 + 1.7, 6, 1)}</g>)}
          <Pylon x={455} top={72} base={176} w={50} arms={[86, 102]} />
          <g className="pr a-zap" style={{ "--d": "5s" } as React.CSSProperties}>
            <path d={bolt(main)} fill="none" stroke={VIOLET} strokeWidth="5" opacity="0.6" style={{ filter: "blur(2px)" }} />
            <path d={bolt(branch)} fill="none" stroke={VIOLET} strokeWidth="3" opacity="0.5" style={{ filter: "blur(1.5px)" }} />
            <path d={bolt(main)} fill="none" stroke={VOLT} strokeWidth="1.8" strokeLinejoin="round" />
            <path d={bolt(branch)} fill="none" stroke={VOLT} strokeWidth="1" strokeLinejoin="round" />
            <path d={bolt(main)} fill="none" stroke={HOT} strokeWidth="0.7" strokeLinejoin="round" />
            <circle cx="455" cy="72" r="9" fill={VOLT} opacity="0.35" style={{ filter: "blur(3px)" }} />
          </g>
          <circle {...m("a-breathe", 2.4)} cx="455" cy="72" r="2.4" fill={HOT} style={{ filter: `drop-shadow(0 0 4px ${VOLT})` }} />
          {range(6).map((i) => <circle key={`sp${i}`} {...m("a-fall", 1.4 + r() * 1.2, r() * 2)} cx={447 + r() * 16} cy={78 + r() * 10} r={0.6 + r() * 0.8} fill={i % 2 ? VOLT : HOT} />)}
          <rect y="168" width="600" height="32" fill="#0a0618" />
          <line x1="0" y1="168" x2="600" y2="168" stroke={VIOLET} strokeOpacity="0.5" />
          {traces.map((t, i) => (
            <g key={`t${i}`}>
              <path d={poly(t)} fill="none" stroke="#2d2350" strokeWidth="1.2" />
              <circle cx={t[0][0]} cy={t[0][1]} r="1.6" fill="#0a0618" stroke={VIOLET} strokeWidth="0.8" />
              <circle cx={t[t.length - 1][0]} cy={t[t.length - 1][1]} r="1.6" fill="#0a0618" stroke={VIOLET} strokeWidth="0.8" />
              {flow(t, 1.8 + (i % 3) * 0.5, r() * 2, 8, 1.2)}
            </g>
          ))}
          {[0, 1].map((i) => (
            <g key={`inv${i}`} {...m("a-slide", 26 + i * 9, i * 11)}>
              <g transform={`translate(${-20 - i * 30} ${46 + i * 16})`} fill={VIOLET} opacity={0.7 - i * 0.2}>{sprite(1.8 - i * 0.4)}</g>
            </g>
          ))}
          <g>
            <rect x="230" y="50" width="188" height="92" rx="7" fill="#0b0618" fillOpacity="0.88" stroke={VIOLET} strokeOpacity="0.7" style={{ filter: `drop-shadow(0 0 6px ${VIOLET})` }} />
            <rect x="230" y="50" width="188" height="13" rx="7" fill="#1a0f3a" />
            <rect x="230" y="57" width="188" height="6" fill="#1a0f3a" />
            {[VIOLET, VOLT, HOT].map((c, i) => <circle key={c} cx={239 + i * 8} cy="56.5" r="2.2" fill={c} opacity="0.9" />)}
            <text x="324" y="59" fontSize="6.5" textAnchor="middle" fill="#a69bc9" fontFamily="ui-monospace, Menlo, monospace">jesse@yoru: ~/night</text>
            <g clipPath={`url(#${g("term")})`}>
              <g className="pr a-scroll-up" style={{ "--len": block, "--d": "14s" } as React.CSSProperties}>
                {[0, 1].map((rep) =>
                  code.map(([p, t], i) => (
                    <text key={`${rep}-${i}`} x="240" y={76 + rep * block + i * LH} fontSize="7.2" fontFamily="ui-monospace, Menlo, monospace" fill={p === "//" ? VIOLET : "#dcd3f7"}>
                      <tspan fill={p === "//" ? VIOLET : VOLT}>{p} </tspan>{t}
                    </text>
                  )),
                )}
              </g>
            </g>
            <rect {...m("a-fade", 1.2)} x="400" y="129" width="5" height="7" fill={VOLT} />
          </g>
          <text x="590" y="194" fontSize="7" textAnchor="end" fill="#a69bc9" fontFamily="ui-monospace, Menlo, monospace" letterSpacing="1">JESKOV.007 · ONLINE</text>
          <circle {...m("a-fade", 2)} cx="503" cy="191.6" r="2" fill={VOLT} style={{ filter: `drop-shadow(0 0 3px ${VOLT})` }} />
        </>
      );
    }
    default:
      return <rect width="600" height="200" fill="#111" />;
  }
}

export function BannerArt({ p, className, still, children }: { p: BannerP; className?: string; still?: boolean; children?: React.ReactNode }) {
  const uid = useId().replace(/:/g, "");
  return (
    <div className={clsx("relative overflow-hidden bg-black", className)} data-banner={p.scene}>
      <svg aria-hidden viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className={clsx("absolute inset-0 h-full w-full", still && "pro-still")}>
        <Scene scene={p.scene} uid={uid} />
      </svg>
      {children}
    </div>
  );
}
