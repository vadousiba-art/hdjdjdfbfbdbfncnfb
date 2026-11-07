"use client";

import { useId } from "react";
import clsx from "clsx";
import type { RingP } from "@/lib/pro/catalog";

// Profile rings, drawn in SVG around the avatar like animated avatar
// decorations: layered art that can break out of the circle (a butterfly on
// the rim, a crown, a crescent) and loops continuously. The avatar fills r=40
// of the 100×100 box, so the face is never covered. Motion is CSS (see the
// motion library in globals.css): it stops for reduced motion, and small
// avatars stay still until hovered.

const TAU = Math.PI * 2;
const pt = (deg: number, r: number) => [50 + r * Math.cos((deg * TAU) / 360), 50 + r * Math.sin((deg * TAU) / 360)] as const;
function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
// Animation props: a motion class, its loop length and a start offset.
const m = (cls: string, d?: number, delay?: number, center = false) => ({
  className: clsx(center ? "pr-c" : "pr", cls),
  style: { "--d": d ? `${d}s` : undefined, animationDelay: delay ? `${delay}s` : undefined } as React.CSSProperties,
});

function Butterfly({ x, y, s, a, b, rot = -20 }: { x: number; y: number; s: number; a: string; b: string; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <g {...m("a-bob", 2.6)}>
        <g {...m("a-flap", 0.7)}>
          <path d="M0,0 C-9,-11 -16,-4 -11,3 C-15,8 -7,12 0,3 Z" fill={a} stroke={b} strokeWidth="0.6" />
          <path d="M0,0 C9,-11 16,-4 11,3 C15,8 7,12 0,3 Z" fill={a} stroke={b} strokeWidth="0.6" />
          <path d="M-9,-4 C-6,-6 -4,-3 -3,-1 M9,-4 C6,-6 4,-3 3,-1" stroke={b} strokeWidth="0.5" fill="none" opacity="0.7" />
        </g>
        <rect x="-0.6" y="-3" width="1.2" height="8" rx="0.6" fill={b} />
      </g>
    </g>
  );
}

function Art({ p, uid }: { p: RingP; uid: string }) {
  const { a, b } = p;
  const g = `${uid}g`;
  const mk = `${uid}m`;
  const band = (
    <mask id={mk}>
      <circle cx="50" cy="50" r="52" fill="#fff" />
      <circle cx="50" cy="50" r="39.5" fill="#000" />
    </mask>
  );
  switch (p.style) {
    // Crimson corona with a dark moon in orbit, RGB glitch echoes and a
    // crimson butterfly perched on the rim.
    case "eclipse":
      return (
        <>
          <defs>
            <radialGradient id={g}>
              <stop offset="72%" stopColor={a} stopOpacity="0" />
              <stop offset="82%" stopColor={a} stopOpacity="0.95" />
              <stop offset="100%" stopColor={b} stopOpacity="0" />
            </radialGradient>
            {band}
          </defs>
          <g {...m("a-breathe", 3.4)}><circle cx="50" cy="50" r="49" fill={`url(#${g})`} /></g>
          <g mask={`url(#${mk})`}>
            <circle {...m("a-glitch", 2.6)} cx="50" cy="50" r="41.5" fill="none" stroke="#2ee6ff" strokeOpacity="0.55" strokeWidth="1.6" />
            <circle {...m("a-glitch-r", 2.6)} cx="50" cy="50" r="41.5" fill="none" stroke={a} strokeWidth="2.2" />
          </g>
          <g {...m("a-rot", 9, 0, true)}>
            <circle cx={pt(-60, 44)[0]} cy={pt(-60, 44)[1]} r="5.2" fill={b} stroke={a} strokeWidth="0.8" />
            <circle cx={pt(120, 45)[0]} cy={pt(120, 45)[1]} r="1.4" fill="#ffd0d8" />
          </g>
          <g {...m("a-rot-rev", 14, 0, true)}>
            {range(5).map((i) => <circle key={i} {...m("a-twinkle", 2.2, i * 0.4)} cx={pt(i * 72 + 20, 47)[0]} cy={pt(i * 72 + 20, 47)[1]} r="0.9" fill="#ff8fa3" />)}
          </g>
          <Butterfly x={13} y={13} s={1.15} a={a} b="#ffb3c1" />
        </>
      );
    // A violet halo floating above the avatar, breathing, with motes.
    case "halo":
      return (
        <>
          <g {...m("a-bob", 3.6)}>
            <ellipse cx="50" cy="9" rx="20" ry="4.5" fill="none" stroke={a} strokeWidth="1.8" style={{ filter: `drop-shadow(0 0 2.5px ${a})` }} />
          </g>
          <g {...m("a-breathe", 3.2)}>
            <circle cx="50" cy="50" r="44.5" fill="none" stroke={a} strokeWidth="1.4" style={{ filter: `drop-shadow(0 0 3px ${a})` }} />
            <circle cx="50" cy="50" r="41.2" fill="none" stroke={a} strokeOpacity="0.3" strokeWidth="2.6" />
          </g>
          {range(6).map((i) => <circle key={i} {...m("a-rise", 2.8, i * 0.45)} cx={pt(150 + i * 48, 46)[0]} cy={pt(150 + i * 48, 46)[1]} r="0.9" fill="#d9ceff" />)}
        </>
      );
    // Circuit traces with data pulses running along them and blinking nodes.
    case "circuit":
      return (
        <>
          <circle cx="50" cy="50" r="41" fill="none" stroke={b} strokeOpacity="0.35" strokeWidth="1" />
          <circle {...m("a-dash", 3)} cx="50" cy="50" r="41" fill="none" stroke={a} strokeWidth="1.4" strokeDasharray="4 26" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
          {range(12).map((i) => {
            const d = i * 30;
            const [x1, y1] = pt(d, 41);
            const [x2, y2] = pt(d, 46.5);
            const [x3, y3] = pt(d + 12, 46.5);
            return (
              <g key={i}>
                <polyline points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="none" stroke={a} strokeOpacity="0.55" strokeWidth="1.1" />
                <polyline {...m("a-dash", 2.2, i * 0.18)} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="none" stroke="#fff" strokeWidth="1.1" strokeDasharray="2 18" />
                <circle {...m("a-twinkle", 1.8, i * 0.15)} cx={x3} cy={y3} r="1.7" fill={i % 3 ? a : b} style={{ filter: `drop-shadow(0 0 1.5px ${a})` }} />
              </g>
            );
          })}
        </>
      );
    // An inked manga panel: the crack draws itself, speed lines flash and an
    // impact mark pops at the corner.
    case "panel":
      return (
        <>
          <rect x="6" y="6" width="88" height="88" fill="none" stroke={b} strokeWidth="5.5" />
          <rect x="6" y="6" width="88" height="88" fill="none" stroke={a} strokeWidth="2.2" />
          <polyline {...m("a-dash", 4)} points="78,6 82,14 79,19 86,24 94,22" fill="none" stroke={b} strokeWidth="2.4" strokeDasharray="30 90" />
          <g {...m("a-fade", 2.4)}>
            {range(7).map((i) => <line key={i} x1={96} y1={70 + i * 3} x2={100 + (i % 2) * 3} y2={70 + i * 3} stroke={a} strokeWidth="0.8" />)}
          </g>
          <g {...m("a-pop", 3)} >
            <polygon points="8,92 12,84 14,90 20,86 17,93 22,96 14,96 11,101" fill={a} stroke={b} strokeWidth="1" />
          </g>
        </>
      );
    // Black flames licking upward, each flickering on its own, embers rising.
    case "flame":
      return (
        <>
          {range(18).map((i) => {
            const d = i * 20;
            const h = 7 + ((i * 7) % 5);
            const [bx1, by1] = pt(d - 7, 39);
            const [bx2, by2] = pt(d + 7, 39);
            const [tx, ty] = pt(d + 3, 39 + h);
            return (
              <path key={i} {...m("a-breathe", 0.9 + (i % 4) * 0.2, (i % 5) * 0.13)}
                d={`M${bx1},${by1} Q${pt(d - 4, 43)[0]},${pt(d - 4, 43)[1]} ${tx},${ty} Q${pt(d + 6, 43)[0]},${pt(d + 6, 43)[1]} ${bx2},${by2} Z`}
                fill={i % 2 ? b : a} stroke={b} strokeWidth="0.6" />
            );
          })}
          <circle cx="50" cy="50" r="39.5" fill="none" stroke={b} strokeWidth="1.4" style={{ filter: `drop-shadow(0 0 2px ${b})` }} />
          {range(8).map((i) => <circle key={i} {...m("a-rise", 1.8, i * 0.27)} cx={pt(200 + i * 18, 48)[0]} cy={pt(200 + i * 18, 48)[1]} r="0.8" fill="#ffb36b" />)}
        </>
      );
    // Two tilted orbits turning in opposite directions, a moon and a star riding them.
    case "orbit":
      return (
        <>
          <g {...m("a-rot", 11, 0, true)}>
            <ellipse cx="50" cy="50" rx="48" ry="39" fill="none" stroke={a} strokeWidth="0.9" transform="rotate(-25 50 50)" />
            <circle cx="94" cy="38" r="3.6" fill={b} style={{ filter: `drop-shadow(0 0 2px ${b})` }} />
          </g>
          <g {...m("a-rot-rev", 15, 0, true)}>
            <ellipse cx="50" cy="50" rx="48" ry="39" fill="none" stroke={a} strokeOpacity="0.5" strokeWidth="0.9" transform="rotate(35 50 50)" />
            <path d="M10,64 l1.2,2.8 3,0.3 -2.3,2 0.7,3 -2.6,-1.6 -2.6,1.6 0.7,-3 -2.3,-2 3,-0.3z" fill={a} />
          </g>
          {range(4).map((i) => <circle key={i} {...m("a-twinkle", 2.4, i * 0.6)} cx={pt(i * 90 + 45, 47)[0]} cy={pt(i * 90 + 45, 47)[1]} r="0.8" fill="#fff" />)}
        </>
      );
    // A wreath of roses gently swaying, petals falling.
    case "roses":
      return (
        <>
          <circle cx="50" cy="50" r="41" fill="none" stroke={b} strokeWidth="2.4" />
          <path d="M50,9 C30,10 12,26 9,48" fill="none" stroke="#2f6b3a" strokeWidth="1" opacity="0.8" />
          {range(8).map((i) => {
            const [x, y] = pt(i * 45 + 22, 43);
            const [lx, ly] = pt(i * 45, 44);
            return (
              <g key={i}>
                <ellipse cx={lx} cy={ly} rx="3.6" ry="1.4" fill="#2f6b3a" transform={`rotate(${i * 45 + 90} ${lx} ${ly})`} />
                <g {...m("a-sway", 3.6, i * 0.3)}>
                  <circle cx={x} cy={y} r="5.2" fill={a} />
                  <path d={`M${x - 2.5},${y} a2.5,2.5 0 1,1 2.5,2.5 a1.6,1.6 0 1,1 -1.6,-1.6`} fill="none" stroke={b} strokeWidth="0.9" />
                </g>
              </g>
            );
          })}
          {range(4).map((i) => <ellipse key={`p${i}`} {...m("a-fall", 3.2, i * 0.8)} cx={pt(40 + i * 30, 47)[0]} cy={pt(40 + i * 30, 47)[1]} rx="1.6" ry="0.9" fill={a} />)}
        </>
      );
    // Out of alignment in short RGB-split bursts, with tearing scan slices.
    case "glitch":
      return (
        <>
          <circle {...m("a-glitch", 2.2)} cx="50" cy="50" r="43" fill="none" stroke={a} strokeWidth="2" strokeDasharray="14 3 6 2" />
          <circle {...m("a-glitch-r", 2.2)} cx="50" cy="50" r="43" fill="none" stroke={b} strokeWidth="2" strokeDasharray="9 4 18 2" />
          <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.6" />
          <rect {...m("a-glitch", 1.7, 0.3)} x="82" y="27" width="13" height="3" fill={a} />
          <rect {...m("a-glitch-r", 1.9, 0.8)} x="4" y="66" width="11" height="2.4" fill={b} />
          <rect {...m("a-flick", 2.5)} x="70" y="88" width="9" height="1.6" fill="#fff" opacity="0.8" />
        </>
      );
    // A silver ring with a crescent moon swaying at the top and twinkling stars.
    case "crescent":
      return (
        <>
          <circle cx="50" cy="50" r="41.5" fill="none" stroke={a} strokeWidth="2.2" />
          <circle {...m("a-dash", 6)} cx="50" cy="50" r="41.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeDasharray="8 120" strokeLinecap="round" />
          <circle cx="50" cy="50" r="44.5" fill="none" stroke={b} strokeWidth="0.6" />
          <g {...m("a-sway", 5)}>
            <path d="M44,1 a9,9 0 1,0 12,0 a7,7 0 1,1 -12,0z" fill={a} style={{ filter: "drop-shadow(0 0 2px #fff)" }} />
          </g>
          {[[18, 16], [85, 20], [92, 72], [10, 78]].map(([x, y], i) => (
            <path key={i} {...m("a-twinkle", 2.4, i * 0.5)} d={`M${x},${y - 2} L${x + 0.6},${y} L${x},${y + 2} L${x - 0.6},${y} Z M${x - 2},${y} L${x},${y + 0.6} L${x + 2},${y} L${x},${y - 0.6} Z`} fill="#fff" />
          ))}
        </>
      );
    // Crackling azure: bolts flicker at two points and an arc runs the rim.
    case "electric":
      return (
        <>
          <circle {...m("a-breathe", 2.2)} cx="50" cy="50" r="42" fill="none" stroke={a} strokeWidth="2.2" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
          <circle {...m("a-dash", 1.6)} cx="50" cy="50" r="42" fill="none" stroke={b} strokeWidth="1.2" strokeDasharray="10 60" />
          {[[-40, 1, 0], [140, -1, 0.7], [60, 1, 1.4]].map(([d, s, delay], i) => {
            const pts = range(5).map((k) => pt(d + k * 6 * s, 42 + (k % 2 ? 6 : -1)));
            return <polyline key={i} {...m("a-flick", 1.8, delay)} points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={b} strokeWidth="1.4" strokeLinejoin="round" />;
          })}
        </>
      );
    // Ink splattering out from an impact: drops drip and splats breathe.
    case "splatter": {
      const r = rand(7);
      return (
        <>
          <circle cx="50" cy="50" r="41" fill="none" stroke={a} strokeWidth="3.2" />
          {range(16).map((i) => {
            const d = r() * 360;
            const [x, y] = pt(d, 43 + r() * 5);
            return <circle key={i} {...m("a-breathe", 2 + (i % 3) * 0.6, i * 0.1)} cx={x} cy={y} r={0.8 + r() * 3} fill={i % 5 === 0 ? b : a} />;
          })}
          {range(5).map((i) => {
            const d = i * 72 + 10;
            const [x1, y1] = pt(d, 42);
            const [x2, y2] = pt(d + 4, 49);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a} strokeWidth="1.6" strokeLinecap="round" />;
          })}
          {[[30, 88], [70, 89], [52, 92]].map(([x, y], i) => (
            <ellipse key={`d${i}`} {...m("a-drip", 3, i * 0.9)} className="pr-b a-drip" cx={x} cy={y} rx="1.4" ry="3" fill={i === 1 ? b : a} />
          ))}
        </>
      );
    }
    // Holographic foil: the colours turn and a sheen sweeps across.
    case "prism": {
      const cols = ["#ff2bd6", "#ffd23f", "#39ff88", "#2ee6ff", "#7c5cff", "#ff3b6b"];
      return (
        <>
          <g {...m("a-rot", 8, 0, true)}>
            {cols.map((c, i) => {
              const [x1, y1] = pt(i * 60, 43);
              const [x2, y2] = pt(i * 60 + 58, 43);
              return <path key={c} d={`M${x1},${y1} A43,43 0 0,1 ${x2},${y2}`} fill="none" stroke={c} strokeWidth="4.2" strokeLinecap="round" />;
            })}
          </g>
          <g {...m("a-rot-rev", 5, 0, true)}>
            <path d={`M${pt(-100, 46)[0]},${pt(-100, 46)[1]} A46,46 0 0,1 ${pt(-60, 46)[0]},${pt(-60, 46)[1]}`} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.4" strokeLinecap="round" />
          </g>
          <circle cx="50" cy="50" r="47.5" fill="none" stroke={a} strokeOpacity="0.6" strokeWidth="0.6" />
        </>
      );
    }
    // Interlocking links turning slowly; the gold link glints.
    case "chains":
      return (
        <>
          <g {...m("a-rot", 40, 0, true)}>
            {range(14).map((i) => {
              const d = i * (360 / 14);
              const [x, y] = pt(d, 43.5);
              return <ellipse key={i} cx={x} cy={y} rx="5.2" ry="3" fill="none" stroke={i === 10 ? b : a} strokeWidth="1.9" transform={`rotate(${d + 90} ${x} ${y})`} />;
            })}
            <circle {...m("a-twinkle", 1.8)} cx={pt(10 * (360 / 14), 43.5)[0]} cy={pt(10 * (360 / 14), 43.5)[1]} r="1.4" fill="#fff6d6" />
          </g>
        </>
      );
    // Layers of pale mist drifting in opposite directions.
    case "mist":
      return (
        <>
          <g {...m("a-rot", 18, 0, true)}>
            <circle cx="50" cy="50" r="44" fill="none" stroke={a} strokeOpacity="0.55" strokeWidth="6" strokeDasharray="40 14 22 18" strokeLinecap="round" style={{ filter: "blur(1.6px)" }} />
          </g>
          <g {...m("a-rot-rev", 24, 0, true)}>
            <circle cx="50" cy="50" r="41" fill="none" stroke={b} strokeOpacity="0.55" strokeWidth="2.4" strokeDasharray="20 30" style={{ filter: "blur(0.8px)" }} />
          </g>
          <g {...m("a-breathe", 4)}>
            <circle cx="50" cy="50" r="47" fill="none" stroke={a} strokeOpacity="0.25" strokeWidth="3" strokeDasharray="10 40" style={{ filter: "blur(2px)" }} />
          </g>
        </>
      );
    // Columns of glyphs falling through the ring.
    case "rain":
      return (
        <>
          <defs>{band}</defs>
          <g mask={`url(#${mk})`}>
            {range(18).map((i) => {
              const x = 4 + i * 5.4;
              return (
                <g key={i} {...m("a-fall", 1.4 + (i % 4) * 0.35, (i % 6) * 0.25)}>
                  {range(4).map((k) => <rect key={k} x={x} y={8 + k * 26 + (i % 3) * 7} width="1.4" height="3.2" fill={k === 0 ? "#d6ffe6" : a} opacity={1 - k * 0.2} />)}
                </g>
              );
            })}
          </g>
          <circle cx="50" cy="50" r="39.6" fill="none" stroke={a} strokeOpacity="0.8" strokeWidth="1.2" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
        </>
      );
    // Glass shards orbiting, each spinning on its own and catching the light.
    case "shards":
      return (
        <g {...m("a-rot", 10, 0, true)}>
          {range(9).map((i) => {
            const d = i * 40;
            const p1 = pt(d, 41);
            const p2 = pt(d + 9, 48);
            const p3 = pt(d + 17, 42);
            return (
              <g key={i} {...m("a-breathe", 2 + (i % 3) * 0.5, i * 0.2)}>
                <polygon points={`${p1} ${p2} ${p3}`} fill={i % 2 ? a : b} />
                <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.5" />
              </g>
            );
          })}
        </g>
      );
    // Twinkling stars with a shooting star crossing every few seconds.
    case "starfall": {
      const r = rand(11);
      return (
        <>
          {range(22).map((i) => {
            const [x, y] = pt(i * (360 / 22), 41 + r() * 6);
            return <circle key={i} {...m("a-twinkle", 1.8 + r() * 1.6, r() * 2)} cx={x} cy={y} r={0.5 + r() * 1.1} fill={a} />;
          })}
          <g {...m("a-shoot", 4.5)}>
            <line x1="76" y1="0" x2="96" y2="-12" stroke={b} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
            <circle cx="76" cy="0" r="1.8" fill="#fff" />
          </g>
        </>
      );
    }
    // A polished ring with a sheen sweeping round and a gilded crown that bobs.
    case "crown":
      return (
        <>
          <circle cx="50" cy="50" r="42" fill="none" stroke={a} strokeWidth="5" />
          <circle {...m("a-dash", 4.5)} cx="50" cy="50" r="42" fill="none" stroke="#5a5a5a" strokeWidth="5" strokeDasharray="6 140" strokeLinecap="round" />
          <circle cx="50" cy="50" r="44.6" fill="none" stroke={b} strokeWidth="0.8" />
          <g {...m("a-bob", 3)}>
            <path d="M37,9 L39,-1 L44.5,5 L50,-4 L55.5,5 L61,-1 L63,9 Z" fill={b} stroke="#7a5a12" strokeWidth="0.6" />
            {[[39, -1], [50, -4], [61, -1]].map(([x, y], i) => <circle key={i} {...m("a-twinkle", 2, i * 0.5)} cx={x} cy={y} r="1.3" fill={i === 1 ? "#e5102f" : "#fff6d6"} />)}
          </g>
        </>
      );
    // A dashed ring that scrolls like a signal, with ripples going out.
    case "dashed":
      return (
        <>
          <circle {...m("a-dash", 5)} cx="50" cy="50" r="43" fill="none" stroke={a} strokeWidth="1.6" strokeDasharray="3 3" />
          <circle {...m("a-ripple", 3)} cx="50" cy="50" r="43" fill="none" stroke={a} strokeWidth="0.8" />
          <circle {...m("a-ripple", 3, 1.5)} cx="50" cy="50" r="43" fill="none" stroke={b} strokeWidth="0.8" />
        </>
      );
    // A turning band of stars and nebula with a gold rim that glints.
    case "galaxy": {
      const r = rand(21);
      return (
        <>
          <g {...m("a-rot", 26, 0, true)}>
            <circle cx="50" cy="50" r="44" fill="none" stroke={a} strokeOpacity="0.5" strokeWidth="9" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="#c48cff" strokeOpacity="0.35" strokeWidth="5" strokeDasharray="30 60" style={{ filter: "blur(1.5px)" }} />
            {range(30).map((i) => {
              const [x, y] = pt(r() * 360, 40 + r() * 8);
              return <circle key={i} {...m("a-twinkle", 1.6 + r() * 2, r() * 2)} cx={x} cy={y} r={0.3 + r() * 0.8} fill={b} />;
            })}
          </g>
          <circle cx="50" cy="50" r="48.6" fill="none" stroke="#e0b54f" strokeWidth="0.9" />
          <circle {...m("a-dash", 5)} cx="50" cy="50" r="48.6" fill="none" stroke="#fff6d6" strokeWidth="1.2" strokeDasharray="5 160" strokeLinecap="round" />
        </>
      );
    }
    // FOUNDER ONLY. Gold rays turning behind the avatar, a ring of runes that
    // spells YORU 夜 FOUNDER 創設者, a double gold rim with a travelling glint,
    // a crimson moon and a star orbiting in opposite directions, a crowned
    // crest that bobs, and embers drifting up.
    case "founder": {
      const path = `${uid}p`;
      return (
        <>
          <defs>
            <radialGradient id={g}>
              <stop offset="60%" stopColor={a} stopOpacity="0" />
              <stop offset="80%" stopColor={a} stopOpacity="0.55" />
              <stop offset="100%" stopColor={a} stopOpacity="0" />
            </radialGradient>
            <path id={path} d="M50,50 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
          </defs>
          <g {...m("a-rot", 40, 0, true)}>
            {range(16).map((i) => {
              const [x1, y1] = pt(i * 22.5, 41);
              const [x2, y2] = pt(i * 22.5 - 3, 58);
              const [x3, y3] = pt(i * 22.5 + 3, 58);
              return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill={a} opacity={i % 2 ? 0.1 : 0.18} />;
            })}
          </g>
          <g {...m("a-breathe", 3.6)}><circle cx="50" cy="50" r="50" fill={`url(#${g})`} /></g>
          <g {...m("a-rot-rev", 30, 0, true)}>
            <text fontSize="5.2" fontWeight="800" letterSpacing="1.2" fill={a} opacity="0.9">
              <textPath href={`#${path}`}>YORU · 夜 · FOUNDER · 創設者 · YORU · 夜 · FOUNDER · 創設者 ·</textPath>
            </text>
          </g>
          <circle cx="50" cy="50" r="41" fill="none" stroke={a} strokeWidth="2.4" />
          <circle cx="50" cy="50" r="43.4" fill="none" stroke={b} strokeWidth="0.8" />
          <circle {...m("a-dash", 3.5)} cx="50" cy="50" r="41" fill="none" stroke="#fff6d6" strokeWidth="2.4" strokeDasharray="7 130" strokeLinecap="round" />
          <g {...m("a-rot", 7, 0, true)}>
            <circle cx={pt(150, 41)[0]} cy={pt(150, 41)[1]} r="4.2" fill={b} stroke={a} strokeWidth="0.8" style={{ filter: `drop-shadow(0 0 2px ${b})` }} />
          </g>
          <g {...m("a-rot-rev", 10, 0, true)}>
            <path d={`M${pt(30, 41)[0]},${pt(30, 41)[1] - 3} l0.9,2.1 2.2,0.2 -1.7,1.5 0.5,2.2 -1.9,-1.2 -1.9,1.2 0.5,-2.2 -1.7,-1.5 2.2,-0.2z`} fill="#fff6d6" />
          </g>
          {range(7).map((i) => <circle key={`e${i}`} {...m("a-rise", 2.4, i * 0.34)} cx={pt(60 + i * 10, 46)[0]} cy={pt(60 + i * 10, 46)[1]} r="0.9" fill={i % 3 ? a : b} />)}
          <g {...m("a-bob", 3.2)}>
            <path d="M36,10 L38,-2 L44,4 L50,-6 L56,4 L62,-2 L64,10 Z" fill={a} stroke="#7a5a12" strokeWidth="0.7" style={{ filter: `drop-shadow(0 0 3px ${a})` }} />
            <rect x="36" y="9" width="28" height="3.2" rx="1" fill="#b8902f" />
            {[[38, -2], [50, -6], [62, -2]].map(([x, y], i) => <circle key={i} {...m("a-twinkle", 2, i * 0.5)} cx={x} cy={y} r="1.5" fill={i === 1 ? b : "#fff6d6"} />)}
          </g>
          <g transform="translate(50 92)">
            <path d="M-8,-5 H8 L9,0 C9,5 4,8 0,9.5 C-4,8 -9,5 -9,0 Z" fill="#1a0408" stroke={a} strokeWidth="1" />
            <text {...m("a-pop", 4)} y="2.6" fontSize="7" textAnchor="middle" fill={a} fontWeight="900">創</text>
          </g>
        </>
      );
    }
    // ADMINS. A radar sweep turning round the avatar, rotating shield plates,
    // scan ticks, an outward watch-pulse and a shield marked 守.
    case "sentinel": {
      const sweep = `${uid}s`;
      return (
        <>
          <defs>
            <linearGradient id={sweep} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={a} stopOpacity="0" />
              <stop offset="1" stopColor={a} stopOpacity="0.55" />
            </linearGradient>
            {band}
          </defs>
          <g mask={`url(#${mk})`}>
            <g {...m("a-rot", 3.2, 0, true)}>
              <path d={`M50,50 L${pt(-40, 52)[0]},${pt(-40, 52)[1]} A52,52 0 0,1 ${pt(0, 52)[0]},${pt(0, 52)[1]} Z`} fill={`url(#${sweep})`} />
              <line x1="50" y1="50" x2={pt(0, 52)[0]} y2={pt(0, 52)[1]} stroke={a} strokeWidth="1" />
            </g>
          </g>
          <circle cx="50" cy="50" r="41" fill="none" stroke={a} strokeOpacity="0.4" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="47.5" fill="none" stroke={a} strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="1 3" />
          <g {...m("a-rot", 18, 0, true)}>
            {range(6).map((i) => {
              const d0 = i * 60 + 6;
              const [x1, y1] = pt(d0, 43);
              const [x2, y2] = pt(d0 + 48, 43);
              const [x3, y3] = pt(d0 + 48, 46.5);
              const [x4, y4] = pt(d0, 46.5);
              return <path key={i} d={`M${x1},${y1} A43,43 0 0,1 ${x2},${y2} L${x3},${y3} A46.5,46.5 0 0,0 ${x4},${y4} Z`} fill={b} stroke={a} strokeWidth="0.7" />;
            })}
          </g>
          <g {...m("a-rot-rev", 24, 0, true)}>
            {range(24).map((i) => {
              const [x1, y1] = pt(i * 15, 48.5);
              const [x2, y2] = pt(i * 15, i % 6 === 0 ? 51.5 : 50);
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a} strokeWidth={i % 6 === 0 ? 1.1 : 0.6} />;
            })}
          </g>
          <circle {...m("a-ripple", 2.6)} cx="50" cy="50" r="44" fill="none" stroke={a} strokeWidth="1" />
          {[[78, 24], [20, 30], [84, 70]].map(([x, y], i) => <circle key={i} {...m("a-twinkle", 1.6, i * 0.5)} cx={x} cy={y} r="1.2" fill="#e9f8ff" />)}
          <g transform="translate(50 92)">
            <path d="M0,-7 L8,-4 V1 C8,5 4,8 0,9.5 C-4,8 -8,5 -8,1 V-4 Z" fill={b} stroke={a} strokeWidth="1.1" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
            <text {...m("a-pop", 3.6)} y="2.8" fontSize="7" textAnchor="middle" fill={a} fontWeight="900">守</text>
          </g>
        </>
      );
    }
    // CO-FOUNDER ONLY (Jesse: an electrician and a developer). A circuit
    // board wired round the avatar with current racing down every trace,
    // lightning arcing off the rim in turns, JESKOV · 007 · CO-FOUNDER turning
    // in a ring, two charged sparks orbiting in opposite directions, a pixel
    // invader on top and a chip stamped 共 below.
    case "cofounder": {
      const path = `${uid}p`;
      const hot = "#fffbe0";
      const r = rand(7);
      const traces = range(14)
        .map((i) => i * (360 / 14) + 6)
        .filter((d) => Math.abs(d - 270) > 20 && Math.abs(d - 90) > 20); // leave the top (invader) and bottom (chip) clear
      const trace = (d: number) => {
        const [x1, y1] = pt(d, 48.5);
        const [x2, y2] = pt(d, 52.5);
        const [x3, y3] = pt(d + 6, 52.5);
        const [x4, y4] = pt(d + 6, 56.5);
        return { d: `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4}`, end: [x4, y4] as const, start: [x1, y1] as const };
      };
      // A jagged bolt from the rim outward.
      const bolt = (d: number) => {
        const steps: [number, number][] = [[0, 43.5], [4, 47], [-3, 50.5], [3, 54], [-2, 57.5], [2, 61]];
        return steps.map(([o, rr], i) => `${i ? "L" : "M"}${pt(d + o, rr)[0].toFixed(2)},${pt(d + o, rr)[1].toFixed(2)}`).join(" ");
      };
      const arc = [200, 207, 213, 220, 226, 233, 240].map((d, i) => pt(d, i % 2 ? 49 : 45)).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
      const invaderA = ["..X...X..", "...X.X...", "..XXXXX..", ".XX.X.XX.", "XXXXXXXXX", "X.XXXXX.X", "X.X...X.X"];
      const invaderB = ["..X...X..", "X..X.X..X", "X.XXXXX.X", "XXX.X.XXX", "XXXXXXXXX", ".XXXXXXX.", ".X.....X."];
      const cell = 1.1;
      const pixels = (rows: string[]) =>
        rows.flatMap((row, y) => [...row].map((c, x) => (c === "X" ? <rect key={`${x}-${y}`} x={45.05 + x * cell} y={-7.6 + y * cell} width={cell + 0.05} height={cell + 0.05} /> : null)));
      return (
        <>
          <defs>
            <radialGradient id={g}>
              <stop offset="62%" stopColor={b} stopOpacity="0" />
              <stop offset="82%" stopColor={b} stopOpacity="0.55" />
              <stop offset="100%" stopColor={b} stopOpacity="0" />
            </radialGradient>
            <path id={path} d="M50,50 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
          </defs>
          <g {...m("a-breathe", 3.2)}><circle cx="50" cy="50" r="52" fill={`url(#${g})`} /></g>
          {traces.map((d, i) => {
            const t = trace(d);
            return (
              <g key={d}>
                <path d={t.d} fill="none" stroke={b} strokeOpacity="0.6" strokeWidth="0.8" strokeLinejoin="round" />
                <path className="pr a-flow" d={t.d} fill="none" stroke={a} strokeWidth="1" strokeLinecap="round" strokeDasharray="3 10.5"
                  style={{ "--len": 13.5, "--d": `${1.1 + (i % 4) * 0.25}s`, animationDelay: `${-r() * 2}s`, filter: `drop-shadow(0 0 1px ${a})` } as React.CSSProperties} />
                <circle cx={t.start[0]} cy={t.start[1]} r="0.7" fill={b} />
                <circle {...m("a-twinkle", 2 + (i % 3) * 0.6, i * 0.3)} cx={t.end[0]} cy={t.end[1]} r="1" fill={a} />
              </g>
            );
          })}
          <g {...m("a-rot-rev", 34, 0, true)}>
            <text fontSize="4.3" fontWeight="800" letterSpacing="0.9" fill={a} opacity="0.92" fontFamily="ui-monospace, Menlo, monospace">
              <textPath href={`#${path}`}>JESKOV · 007 · CO-FOUNDER · 共同創設者 · ⚡ · JESKOV · 007 · CO-FOUNDER · 共同創設者 · ⚡ ·</textPath>
            </text>
          </g>
          <circle cx="50" cy="50" r="43.2" fill="none" stroke={b} strokeWidth="0.7" />
          <circle cx="50" cy="50" r="41" fill="none" stroke={b} strokeWidth="2.4" />
          <circle cx="50" cy="50" r="39.9" fill="none" stroke={a} strokeOpacity="0.55" strokeWidth="0.5" />
          <circle {...m("a-dash", 2.2)} cx="50" cy="50" r="41" fill="none" stroke={a} strokeWidth="2.4" strokeDasharray="6 120" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
          <circle {...m("a-dash", 3.1, 1)} cx="50" cy="50" r="41" fill="none" stroke={hot} strokeWidth="1.2" strokeDasharray="3 125" strokeLinecap="round" />
          {[-28, 38, 148, 322].map((d, i) => (
            <g key={d} className="pr a-zap" style={{ "--d": `${3.6 + i * 0.7}s`, animationDelay: `${i * 0.9}s` } as React.CSSProperties}>
              <path d={bolt(d)} fill="none" stroke={b} strokeWidth="2.6" strokeLinejoin="round" opacity="0.55" style={{ filter: "blur(0.8px)" }} />
              <path d={bolt(d)} fill="none" stroke={a} strokeWidth="1" strokeLinejoin="round" />
              <path d={bolt(d)} fill="none" stroke={hot} strokeWidth="0.4" strokeLinejoin="round" />
            </g>
          ))}
          <g className="pr a-zap" style={{ "--d": "5.2s", animationDelay: "2.2s" } as React.CSSProperties}>
            <path d={arc} fill="none" stroke={b} strokeWidth="2.2" opacity="0.5" style={{ filter: "blur(0.8px)" }} />
            <path d={arc} fill="none" stroke={a} strokeWidth="0.9" />
          </g>
          <g {...m("a-rot", 4.6, 0, true)}>
            <circle cx={pt(0, 41)[0]} cy={pt(0, 41)[1]} r="2.2" fill={hot} style={{ filter: `drop-shadow(0 0 2.5px ${a})` }} />
          </g>
          <g {...m("a-rot-rev", 6.8, 0, true)}>
            <circle cx={pt(180, 41)[0]} cy={pt(180, 41)[1]} r="1.8" fill={b} stroke={hot} strokeWidth="0.5" style={{ filter: `drop-shadow(0 0 2px ${b})` }} />
          </g>
          {range(6).map((i) => <circle key={`s${i}`} {...m("a-rise", 2.2 + (i % 3) * 0.5, i * 0.4)} cx={pt(70 + i * 8, 47)[0]} cy={pt(70 + i * 8, 47)[1]} r="0.8" fill={i % 2 ? a : hot} />)}
          <g {...m("a-bob", 2.8)}>
            <g fill={b} style={{ filter: `drop-shadow(0 0 2px ${b})` }}>
              <g className="pr a-frame-a">{pixels(invaderA)}</g>
              <g className="pr a-frame-b">{pixels(invaderB)}</g>
            </g>
            <rect x={45.05 + 3 * cell} y={-7.6 + 3 * cell} width={cell} height={cell} fill={a} />
            <rect x={45.05 + 5 * cell} y={-7.6 + 3 * cell} width={cell} height={cell} fill={a} />
          </g>
          <g transform="translate(50 92)">
            <g stroke={a} strokeWidth="0.9" strokeLinecap="round">
              {[-4.5, -1.5, 1.5, 4.5].map((x) => <line key={`t${x}`} x1={x} y1="-7.5" x2={x} y2="-5.5" />)}
              {[-4.5, -1.5, 1.5, 4.5].map((x) => <line key={`b${x}`} x1={x} y1="5.5" x2={x} y2="7.5" />)}
              {[-3, 0, 3].map((y) => <line key={`l${y}`} x1="-9.5" y1={y} x2="-7.5" y2={y} />)}
              {[-3, 0, 3].map((y) => <line key={`r${y}`} x1="7.5" y1={y} x2="9.5" y2={y} />)}
            </g>
            <rect x="-7.5" y="-5.5" width="15" height="11" rx="1.6" fill="#1a0f3a" stroke={a} strokeWidth="1" style={{ filter: `drop-shadow(0 0 2px ${a})` }} />
            <text {...m("a-pop", 3.4)} y="2.5" fontSize="7" textAnchor="middle" fill={a} fontWeight="900">共</text>
          </g>
        </>
      );
    }
    default:
      return <circle cx="50" cy="50" r="43" fill="none" stroke={a} strokeWidth="2" />;
  }
}

// Absolutely positioned around a square avatar of `size` px.
export function RingOverlay({ p, size, still }: { p: RingP; size: number; still?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const box = size * 1.3;
  return (
    <svg
      aria-hidden
      viewBox="-2 -2 104 104"
      width={box}
      height={box}
      className={clsx("pointer-events-none absolute", still && "pro-still")}
      style={{ left: (size - box) / 2, top: (size - box) / 2, overflow: "visible" }}
    >
      <Art p={p} uid={uid} />
    </svg>
  );
}
