// Day 3 of the goal series: the cut a-roll (scripts/cut.py) with the YORU look on top.
// Same structure as Day 2 (goal2/Goal2.tsx); the inserts are drawn in the app's own style:
// a first post meeting its first audience, and the five Moonrise phases (docs/MOONRISE.md).
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Composition, Folder, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AppIcon, H, Hook, TopPanel, W } from "../brand-lab/parts";
import { C, FONT, TEXT_ON_VIDEO } from "../shared/theme";
import { AUDIENCE, At, Event, LINES, PHASES, VERSIONS, Version } from "./versions";

type Seg = { seg: number; clip: string; srcStartMs: number; srcEndMs: number; outStartMs: number; outEndMs: number; faceY: number | null };
type OutWord = { seg: number; clip: string; i: number; text: string; startMs: number; endMs: number };
type Edit = { fps: number; frames: number; durationMs: number; segments: Seg[]; words: OutWord[] };
type Props = { version: string; edit: Edit | null };

// ------------------------------------------------------------------ timing
const when = (e: Edit, at: At): number | null => {
  if ("start" in at) return e.segments.find((s) => s.clip === at.clip)?.outStartMs ?? null;
  return e.words.find((w) => w.clip === at.clip && w.i === at.i)?.startMs ?? null;
};

type Caption = { text: string; key?: string; s: number; e: number; segEnd: number };
const captionsOf = (e: Edit): Caption[] => {
  const out: Caption[] = [];
  const seen = new Set<string>();
  for (const s of e.segments) {
    const k = `${s.seg}`;
    if (seen.has(k)) continue;
    seen.add(k);
    // a caption never outlives its take: it ends at the take's last frame
    const segEnd = Math.max(...e.segments.filter((x) => x.seg === s.seg).map((x) => x.outEndMs));
    for (const [from, to, text, key] of LINES[s.clip] ?? []) {
      const a = e.words.find((w) => w.seg === s.seg && w.i === from);
      const b = e.words.find((w) => w.seg === s.seg && w.i === to);
      if (a && b) out.push({ text, key, s: a.startMs, e: b.endMs, segEnd });
    }
  }
  return out.sort((x, y) => x.s - y.s);
};

// ------------------------------------------------------------------ the moon (same drawing as the app's MoonGlyph)
const LIT = [0, 0.24, 0.5, 1, 1];
const NAMES = ["New Moon", "Crescent", "Half Moon", "Full Moon", "Blood Moon"];
const Moon: React.FC<{ phase: number; size: number; glow?: number; dim?: boolean }> = ({ phase, size, glow = 0, dim }) => {
  const f = LIT[phase];
  const blood = phase === 4;
  const lit = blood ? "#ff3d55" : "#f3efe3";
  const c = 12;
  const r = 9.5;
  const rx = r * Math.abs(1 - 2 * f);
  const d = f > 0 && f < 1 ? `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${f < 0.5 ? 0 : 1} ${c} ${c - r} Z` : null;
  const shine = blood ? "rgba(255,61,85,0.8)" : "rgba(243,239,227,0.7)";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: "block", overflow: "visible", opacity: dim ? 0.32 : 1, filter: glow > 0 ? `drop-shadow(0 0 ${glow}px ${shine})` : undefined }}>
      <circle cx={c} cy={c} r={r} fill="#2a2932" stroke="#ffffff" strokeOpacity={0.62} strokeWidth={1.1} />
      {f >= 1 ? <circle cx={c} cy={c} r={r} fill={lit} /> : d ? <path d={d} fill={lit} /> : null}
      {f >= 1 ? (
        <g fill={blood ? "#c41f38" : "#ddd6c4"} opacity={0.55}>
          <circle cx={9} cy={9.5} r={1.7} />
          <circle cx={14.6} cy={13.8} r={2.2} />
          <circle cx={10.4} cy={15.6} r={1} />
        </g>
      ) : null}
    </svg>
  );
};

// ------------------------------------------------------------------ pieces
const Line: React.FC<{ c: Caption; y: number }> = ({ c, y }) => (
  <div style={{ position: "absolute", left: 0, width: W, top: y - 40, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 66, lineHeight: 1.2, color: "#fff", whiteSpace: "nowrap" }}>
    {c.text.split(" ").map((t, k) => (
      <React.Fragment key={k}>
        {k > 0 ? " " : null}
        <span style={{ ...TEXT_ON_VIDEO, color: t === c.key ? C.redBright : "#fff" }}>{t}</span>
      </React.Fragment>
    ))}
  </div>
);

const pop = (frame: number, at: number, fps: number, stiffness = 260) => spring({ frame: frame - at, fps, config: { damping: 15, stiffness } });

// A first post, the way strangers meet it in For You, and the 20 people it's shown to first.
const FirstShot: React.FC<{ since: number; dots: number[]; more: number }> = ({ since, dots, more }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, since, fps, 180);
  const m = pop(frame, more, fps);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: C.ink }}>
      <div style={{ position: "absolute", left: 70, right: 70, top: 92 + 50 * (1 - p), display: "flex", alignItems: "center", gap: 12, fontSize: 31, fontWeight: 600, color: C.muted, whiteSpace: "nowrap" }}>
        <Moon phase={0} size={34} />
        <span style={{ color: C.ink2 }}>New Moon</span>
        <span>·</span>
        <span>New post in #anime</span>
        <span>·</span>
        <span style={{ color: C.redBright, fontWeight: 700 }}>You&apos;re early</span>
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 152 + 50 * (1 - p), background: C.card2, border: `2px solid ${C.line}`, borderRadius: 28, padding: "30px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <AppIcon size={80} />
          <div style={{ flex: 1, lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: 36 }}>your first post</div>
            <div style={{ color: C.muted, fontSize: 28, fontWeight: 600 }}>0 followers · just now</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `2px solid ${C.line}`, borderRadius: 999, padding: "8px 18px", fontSize: 26, fontWeight: 700, color: C.ink2 }}>
            <Moon phase={0} size={28} /> New Moon
          </div>
        </div>
        <div style={{ marginTop: 22, fontSize: 38, fontWeight: 600, lineHeight: 1.3 }}>
          finally posted my art <span style={{ color: C.redBright }}>#anime</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, width: W, top: 506, textAlign: "center", fontSize: 32, fontWeight: 700, color: C.ink2, opacity: dots.length && frame >= dots[0] ? 1 : 0 }}>
        shown first to <span style={{ color: C.redBright }}>20 people</span> who like #anime
      </div>
      <div style={{ position: "absolute", left: 108, top: 576, width: 864, display: "flex", flexWrap: "wrap", gap: "26px 24px" }}>
        {dots.map((at, k) => {
          const s = pop(frame, at, fps, 320);
          return (
            <div key={k} style={{ width: 64, height: 64, borderRadius: 999, background: `hsl(${(k * 47) % 360} 18% ${26 + (k % 3) * 6}%)`, border: `2px solid ${C.line}`, transform: `scale(${frame < at ? 0 : s})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width={34} height={34} fill="rgba(245,245,245,0.75)"><circle cx="12" cy="8.5" r="4.2" /><path d="M3.8 21c.6-4.4 4-7 8.2-7s7.6 2.6 8.2 7z" /></svg>
            </div>
          );
        })}
      </div>
      {frame >= more ? (
        <div style={{ position: "absolute", left: 0, width: W, top: 790 + 30 * (1 - m), display: "flex", justifyContent: "center", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700, color: C.ink2, opacity: m }}>
          <span style={{ color: C.muted }}>love it?</span>
          <Moon phase={1} size={34} /> 100
          <span style={{ color: C.muted }}>→</span>
          <Moon phase={2} size={34} /> 500
          <span style={{ color: C.muted }}>→</span>
          <Moon phase={4} size={34} /> <span style={{ color: C.redBright }}>everyone</span>
        </div>
      ) : null}
    </div>
  );
};

const REACH = ["shown to 20 people who like it", "they loved it: 100 more people", "they loved it: 500 more", "its whole fandom", "everyone on YORU"];
const SLOT = [140, 340, 540, 740, 940];

// The climb: five phases, the line filling as the post moves up.
const Climb: React.FC<{ steps: number[] }> = ({ steps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phase = Math.max(0, steps.filter((t) => frame >= t).length - 1);
  const at = steps[phase];
  const s = pop(frame, at, fps, 220);
  const prev = phase > 0 ? (phase - 1) / 4 : 0;
  const fill = prev + (phase / 4 - prev) * s;
  const blood = phase === 4;
  const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 1.6);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT, color: C.ink, background: blood ? `radial-gradient(70% 60% at 50% 40%, rgba(242,13,47,${0.22 * s}) 0%, rgba(18,18,18,0) 70%)` : undefined }}>
      <div style={{ position: "absolute", left: 70, top: 92, display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontWeight: 800, fontSize: 48 }}>Moonrise</span>
        <span style={{ color: C.muted, fontSize: 30, fontWeight: 600 }}>how far your post goes</span>
      </div>
      <div style={{ position: "absolute", left: SLOT[0], width: SLOT[4] - SLOT[0], top: 378, height: 6, borderRadius: 6, background: C.line }} />
      <div style={{ position: "absolute", left: SLOT[0], width: (SLOT[4] - SLOT[0]) * fill, top: 378, height: 6, borderRadius: 6, background: blood ? C.red : C.ink2 }} />
      {SLOT.map((x, k) => {
        const cur = k === phase;
        const size = cur ? 128 + 14 * (1 - s) : 92;
        return (
          <div key={k} style={{ position: "absolute", left: x - 80, top: 381 - 80, width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {cur && !blood ? <div style={{ position: "absolute", width: 168, height: 168, borderRadius: 999, border: `4px solid ${C.red}`, opacity: 0.35 + 0.55 * pulse, transform: `scale(${1 + 0.06 * pulse})` }} /> : null}
            <div style={{ borderRadius: 999, background: C.card }}>
              <Moon phase={k} size={size} dim={k > phase} glow={cur && k >= 3 ? 10 + 14 * pulse : 0} />
            </div>
          </div>
        );
      })}
      {SLOT.map((x, k) => (
        <div key={`n${k}`} style={{ position: "absolute", left: x - 100, width: 200, top: 490, textAlign: "center", fontSize: 27, fontWeight: k === phase ? 800 : 600, color: k === phase ? C.ink : k < phase ? C.ink2 : C.muted }}>
          {NAMES[k]}
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, width: W, top: 610 + 40 * (1 - s), textAlign: "center", opacity: s }}>
        <div style={{ fontWeight: 900, fontSize: 92, letterSpacing: "-0.03em", color: blood ? C.redBright : C.ink }}>{NAMES[phase]}</div>
        <div style={{ marginTop: 10, fontWeight: 700, fontSize: 38, color: C.muted }}>{REACH[phase]}</div>
      </div>
    </div>
  );
};

const Cta: React.FC<{ since: number; chip: number; title: string; sub: string; chipText?: string }> = ({ since, chip, title, sub, chipText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - since, fps, config: { damping: 15, stiffness: 180 } });
  const q = spring({ frame: frame - chip, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 330 + 60 * (1 - p), background: C.card, border: `2px solid ${C.line}`, borderRadius: 28, padding: "26px 30px", fontFamily: FONT, color: C.ink, display: "flex", alignItems: "center", gap: 22, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
      <AppIcon size={76} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 36 }}>{title}</div>
        <div style={{ color: C.muted, fontSize: 27, marginTop: 4 }}>{sub}</div>
      </div>
      {chipText && frame >= chip ? <div style={{ transform: `scale(${0.6 + 0.4 * q})`, background: C.red, color: "#fff", borderRadius: 999, padding: "10px 30px", fontWeight: 800, fontSize: 44, letterSpacing: "0.02em" }}>{chipText}</div> : null}
    </div>
  );
};

// ------------------------------------------------------------------ the reel
const SPLITS = ["first", "climb"];
const Reel: React.FC<Props> = ({ version, edit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = VERSIONS.find((x) => x.id === version) as Version;
  if (!edit) return <AbsoluteFill style={{ background: C.night }} />;
  const ms = (frame / fps) * 1000;
  const f = (t: number) => Math.round((t / 1000) * fps);
  const timed = v.events.map((e) => ({ e, t: when(edit, e.at) })).filter((x): x is { e: Event; t: number } => x.t !== null).sort((a, b) => a.t - b.t);
  const layout = [...timed].reverse().find((x) => x.t <= ms && [...SPLITS, "face"].includes(x.e.type));
  const split = layout && layout.e.type !== "face" ? layout : null;
  const firstSplit = timed.find((x) => SPLITS.includes(x.e.type));
  const seg = edit.segments.find((s) => ms >= s.outStartMs && ms < s.outEndMs) ?? edit.segments[edit.segments.length - 1];
  const faceY = seg.faceY ?? 0.38;
  const hookEnd = Math.min(v.hook.until ? (when(edit, v.hook.until) ?? Infinity) : Infinity, firstSplit ? firstSplit.t : Infinity);
  const caps = captionsOf(edit);
  const cap = caps.find((c, k) => {
    const next = caps[k + 1];
    const end = Math.min(c.segEnd, next ? Math.min(next.s - 20, next.s - c.e < 250 ? next.s : c.e + 100) : c.e + 300);
    return ms >= c.s - 20 && ms < end;
  });
  const cta = timed.find((x) => x.e.type === "cta" && x.t <= ms);
  const video = staticFile(`recordings/goal3/${version}/aroll.mp4`);
  // the audience fills in, one person at a time, between "every single person" and "seen"
  const a0 = when(edit, AUDIENCE.from);
  const a1 = when(edit, AUDIENCE.to);
  const dots = a0 !== null && a1 !== null ? Array.from({ length: 20 }, (_, k) => f(a0 + ((a1 - a0) * k) / 19)) : [];
  const more = when(edit, AUDIENCE.more);
  const steps = PHASES.map((p) => when(edit, p)).filter((t): t is number => t !== null).map(f);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {split ? (
        <div style={{ position: "absolute", left: 0, top: H / 2, width: W, height: H / 2, overflow: "hidden" }}>
          <OffthreadVideo src={video} style={{ position: "absolute", left: 0, top: H * 0.25 - faceY * H, width: W, height: H }} />
        </div>
      ) : (
        <AbsoluteFill>
          <OffthreadVideo src={video} style={{ width: W, height: H, objectFit: "cover" }} />
        </AbsoluteFill>
      )}
      {split ? (
        <TopPanel>
          {split.e.type === "first" ? <FirstShot since={f(split.t)} dots={dots} more={more === null ? 1e9 : f(more)} /> : null}
          {split.e.type === "climb" ? <Climb steps={steps} /> : null}
        </TopPanel>
      ) : null}
      {ms < hookEnd ? <Hook style={v.hook.style} lines={v.hook.lines} /> : null}
      {cta ? (() => { const c = cta.e as Extract<Event, { type: "cta" }>; return <Cta since={f(cta.t)} chip={f((c.chipAt ? when(edit, c.chipAt) : null) ?? cta.t)} title={c.title} sub={c.sub} chipText={c.chip} />; })() : null}
      {cap ? <Line c={cap} y={split ? H / 2 : H * 0.68} /> : null}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ registration
const meta: CalculateMetadataFunction<Props> = async ({ props }) => {
  const res = await fetch(staticFile(`recordings/goal3/${props.version}/edit.json`));
  const edit: Edit = await res.json();
  return { durationInFrames: edit.frames, props: { ...props, edit } };
};

export const Goal3: React.FC = () => (
  <Folder name="Goal3">
    {VERSIONS.map((v) => (
      <Composition key={v.id} id={`Goal3-${v.id}`} component={Reel} durationInFrames={900} fps={30} width={1080} height={1920}
        defaultProps={{ version: v.id, edit: null }} calculateMetadata={meta} />
    ))}
  </Folder>
);
