// The goal video: the cut a-roll (scripts/cut.py) with the YORU look on top.
import React from "react";
import { AbsoluteFill, CalculateMetadataFunction, Composition, Folder, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AppIcon, H, Hook, Still, TopPanel, W } from "../brand-lab/parts";
import { C, FONT, TEXT_ON_VIDEO } from "../shared/theme";
import { At, Event, GOAL, LINES, PEOPLE, VERSIONS, Version } from "./versions";

type Seg = { seg: number; clip: string; srcStartMs: number; srcEndMs: number; outStartMs: number; outEndMs: number; faceY: number | null };
type OutWord = { seg: number; clip: string; i: number; text: string; startMs: number; endMs: number };
type Edit = { fps: number; frames: number; durationMs: number; segments: Seg[]; words: OutWord[] };
type Props = { version: string; edit: Edit | null };

// ------------------------------------------------------------------ timing
const when = (e: Edit, at: At): number | null => {
  if ("start" in at) return e.segments.find((s) => s.clip === at.clip)?.outStartMs ?? null;
  return e.words.find((w) => w.clip === at.clip && w.i === at.i)?.startMs ?? null;
};


type Caption = { text: string; key?: string; s: number; e: number };
const captionsOf = (e: Edit): Caption[] => {
  const out: Caption[] = [];
  // walk the segments in output order so a clip used twice is captioned where it plays
  const seen = new Set<string>();
  for (const s of e.segments) {
    const k = `${s.seg}`;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const [from, to, text, key] of LINES[s.clip] ?? []) {
      const a = e.words.find((w) => w.seg === s.seg && w.i === from);
      const b = e.words.find((w) => w.seg === s.seg && w.i === to);
      if (a && b) out.push({ text, key, s: a.startMs, e: b.endMs });
    }
  }
  return out.sort((x, y) => x.s - y.s);
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

const Counter: React.FC<{ stage: "now" | "goal"; since: number }> = ({ stage, since }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - since, fps, config: { damping: 16, stiffness: 170 } });
  const n = Math.round(PEOPLE * Math.min(1, (frame - since) / 10));
  const goal = stage === "goal";
  return (
    <div style={{ position: "absolute", inset: 0, background: C.night, fontFamily: FONT, color: C.ink }}>
      <div style={{ position: "absolute", left: 70, right: 70, top: 200 + (goal ? 0 : 70 * (1 - p)), background: C.card, border: `2px solid ${C.line}`, borderRadius: 30, padding: "34px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <AppIcon size={64} />
          <div style={{ flex: 1, fontWeight: 800, fontSize: 36 }}>YORU</div>
          <div style={{ border: `2px solid ${C.red}`, borderRadius: 999, padding: "6px 20px", fontWeight: 700, fontSize: 28 }}>Day 0</div>
        </div>
        <div style={{ color: C.muted, fontSize: 30, fontWeight: 600, marginTop: 26 }}>people on the app</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 800, fontSize: 168, lineHeight: 1, letterSpacing: "-0.03em" }}>{goal ? PEOPLE : n}</span>
          <span style={{ fontWeight: 800, fontSize: 76, color: goal ? C.redBright : C.muted }}>/ {GOAL.toLocaleString("en-US")}</span>
        </div>
        <div style={{ position: "relative", marginTop: 30, height: 20, borderRadius: 20, background: C.card2 }}>
          <div style={{ width: `max(14px, ${(100 * PEOPLE) / GOAL}%)`, height: "100%", borderRadius: 20, background: `linear-gradient(90deg, ${C.redDark}, ${C.red})` }} />
          {goal ? <div style={{ position: "absolute", right: -4, top: -10, width: 8, height: 40, borderRadius: 4, background: C.redBright }} /> : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, color: C.muted, fontSize: 26, fontWeight: 600 }}>
          <span>{((100 * PEOPLE) / GOAL).toFixed(1)}% there</span>
          <span style={{ color: goal ? C.ink : C.muted }}>{goal ? "goal · Nov 30" : ""}</span>
        </div>
      </div>
    </div>
  );
};

const Count: React.FC<{ n: number; red?: boolean }> = ({ n, red }) => (
  <div style={{ position: "absolute", inset: 0, background: C.night, fontFamily: FONT, color: C.ink }}>
    <div style={{ position: "absolute", top: 150, width: W, textAlign: "center", fontWeight: 900, fontSize: 380, lineHeight: 1, letterSpacing: "-0.04em", color: red ? C.red : C.ink, fontVariantNumeric: "tabular-nums", textShadow: red ? "0 0 80px rgba(242,13,47,0.5)" : "none" }}>{n}</div>
    <div style={{ position: "absolute", top: 570, width: W, textAlign: "center", fontWeight: 800, fontSize: 50, color: red ? C.ink : C.muted }}>{red ? "days left in November" : "days?"}</div>
  </div>
);

const Cta: React.FC<{ since: number; chip: number; sub: string }> = ({ since, chip, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - since, fps, config: { damping: 15, stiffness: 180 } });
  const q = spring({ frame: frame - chip, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 330 + 60 * (1 - p), background: C.card, border: `2px solid ${C.line}`, borderRadius: 28, padding: "26px 30px", fontFamily: FONT, color: C.ink, display: "flex", alignItems: "center", gap: 22, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
      <AppIcon size={76} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 36 }}>Comment the word</div>
        <div style={{ color: C.muted, fontSize: 27, marginTop: 4 }}>{sub}</div>
      </div>
      {frame >= chip ? <div style={{ transform: `scale(${0.6 + 0.4 * q})`, background: C.red, color: "#fff", borderRadius: 999, padding: "10px 30px", fontWeight: 800, fontSize: 44, letterSpacing: "0.02em" }}>NIGHT</div> : null}
    </div>
  );
};

// ------------------------------------------------------------------ the reel
const Reel: React.FC<Props> = ({ version, edit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const v = VERSIONS.find((x) => x.id === version) as Version;
  if (!edit) return <AbsoluteFill style={{ background: C.night }} />;
  const ms = (frame / fps) * 1000;
  const f = (t: number) => Math.round((t / 1000) * fps);
  const timed = v.events.map((e) => ({ e, t: when(edit, e.at) })).filter((x): x is { e: Event; t: number } => x.t !== null).sort((a, b) => a.t - b.t);
  // the layout now: the latest split-type event (app/counter/count/face) that has started
  const layout = [...timed].reverse().find((x) => x.t <= ms && ["app", "counter", "count", "face"].includes(x.e.type));
  const split = layout && layout.e.type !== "face" ? layout : null;
  const firstSplit = timed.find((x) => ["app", "counter", "count"].includes(x.e.type));
  const seg = edit.segments.find((s) => ms >= s.outStartMs && ms < s.outEndMs) ?? edit.segments[edit.segments.length - 1];
  const faceY = seg.faceY ?? 0.38;
  const hookEnd = Math.min(v.hook.until ? (when(edit, v.hook.until) ?? Infinity) : Infinity, firstSplit ? firstSplit.t : Infinity);
  const caps = captionsOf(edit);
  const cap = caps.find((c, k) => {
    const next = caps[k + 1];
    const end = next ? Math.min(next.s - 20, next.s - c.e < 250 ? next.s : c.e + 100) : c.e + 300;
    return ms >= c.s - 20 && ms < end;
  });
  const brolls = timed.filter((x) => x.e.type === "broll");
  const cta = timed.find((x) => x.e.type === "cta" && x.t <= ms);
  const video = staticFile(`recordings/goal1/${version}/aroll.mp4`);
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
      {brolls.map(({ e, t }) => {
        const until = when(edit, (e as Extract<Event, { type: "broll" }>).until);
        return until === null ? null : (
          <Sequence key={t} from={f(t)} durationInFrames={Math.max(1, f(until) - f(t))} premountFor={0}>
            <AbsoluteFill>
              <OffthreadVideo src={staticFile("recordings/goal1/C128-graded.mp4")} muted trimBefore={f((e as Extract<Event, { type: "broll" }>).fromMs)} style={{ width: W, height: H, objectFit: "cover" }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      {split ? (
        <TopPanel>
          {split.e.type === "app" ? <Still src="brand/screens/1-home.png" box={{ x: 50, y: 70, w: W - 100, h: H / 2 - 120 }} /> : null}
          {split.e.type === "counter" ? <Counter stage={split.e.stage} since={f(split.t)} /> : null}
          {split.e.type === "count" ? <Count n={split.e.n} red={split.e.red} /> : null}
        </TopPanel>
      ) : null}
      {ms < hookEnd ? <Hook style={v.hook.style} lines={v.hook.lines} /> : null}
      {cta ? <Cta since={f(cta.t)} chip={f(when(edit, (cta.e as Extract<Event, { type: "cta" }>).chipAt) ?? cta.t)} sub={(cta.e as Extract<Event, { type: "cta" }>).sub} /> : null}
      {cap ? <Line c={cap} y={split ? H / 2 : H * 0.68} /> : null}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ registration
const meta: CalculateMetadataFunction<Props> = async ({ props }) => {
  const res = await fetch(staticFile(`recordings/goal1/${props.version}/edit.json`));
  const edit: Edit = await res.json();
  return { durationInFrames: edit.frames, props: { ...props, edit } };
};

export const Goal1: React.FC = () => (
  <Folder name="Goal1">
    {VERSIONS.map((v) => (
      <Composition key={v.id} id={`Goal1-${v.id}`} component={Reel} durationInFrames={900} fps={30} width={1080} height={1920}
        defaultProps={{ version: v.id, edit: null }} calculateMetadata={meta} />
    ))}
  </Folder>
);


