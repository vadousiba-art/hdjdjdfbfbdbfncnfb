// The Brand Lab: 20 short samples of the YORU look, one composition each (BrandLab01..20).
// Takes come from public/recordings/ with their .words.json; captions are chunked by hand.
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EMOJI, FONT, TAGLINE, TEXT_ON_VIDEO } from "../shared/theme";
import { AppIcon, Captions, CaptionStyle, Chunk, Ground, H, Hook, HookStyle, Label, Speaker, Still, Tag, TopPanel, W, Word } from "./parts";

export type LabProps = { words: Word[] };
const ms = (frame: number, fps: number) => (frame / fps) * 1000;
const pop = (frame: number, fps: number, at: number, damping = 14) => spring({ frame: frame - at, fps, config: { damping, stiffness: 180 } });

// ------------------------------------------------------------------ the takes
type Take = { take: string; trimMs: number; frames: number; faceY: number; chunks: Chunk[]; fix?: Record<number, string> };
const T17: Take = {
  // "I'm 17 and I'm building a social media app."
  take: "day1-P211343129", trimMs: 2600, frames: 90, faceY: 0.399,
  chunks: [{ from: 0, to: 1, key: 1 }, { from: 2, to: 4 }, { from: 5, to: 7 }, { from: 8, to: 8, key: 8 }],
};
const TPING: Take = {
  // "Or B: a ping button that pings all your friends and all group chats at once."
  take: "day1-P2107051152", trimMs: 350, frames: 146, faceY: 0.471, fix: { 1: "B:" },
  chunks: [{ from: 0, to: 1, key: 1 }, { from: 2, to: 4, key: 3 }, { from: 5, to: 6 }, { from: 7, to: 9, key: 9 }, { from: 10, to: 11 }, { from: 12, to: 13, key: 13 }, { from: 14, to: 15 }],
};
const TFEED: Take = {
  // "A: a feed that only pops up at midnight."
  take: "day1-P210658805", trimMs: 100, frames: 96, faceY: 0.484, fix: { 0: "A:" },
  chunks: [{ from: 0, to: 0, key: 0 }, { from: 1, to: 3, key: 2 }, { from: 4, to: 6 }, { from: 7, to: 8, key: 8 }],
};
const TCTA: Take = {
  // "Comment A or B in the comments and I'll build it tonight."
  take: "day1-P210436535", trimMs: 300, frames: 81, faceY: 0.431,
  chunks: [{ from: 0, to: 0 }, { from: 1, to: 3 }, { from: 4, to: 6, key: 6 }, { from: 7, to: 9, key: 9 }, { from: 10, to: 11, key: 11 }],
};
const TAPP: Take = {
  // 'And the app is called "Yoru", the night is truly for anyone.'
  take: "day1-P210821747", trimMs: 100, frames: 117, faceY: 0.4, fix: { 5: "YORU," },
  chunks: [{ from: 0, to: 2 }, { from: 3, to: 5, key: 5 }, { from: 6, to: 8, key: 7 }, { from: 9, to: 11, key: 11 }],
};

const wordAt = (t: Take, words: Word[], i: number) => words[i].startMs - t.trimMs; // ms into the sample

// ------------------------------------------------------------------ grounds and colour
const Crescent: React.FC<{ size: number; glow: number }> = ({ size, glow }) => (
  <div style={{ position: "relative", width: size, height: size }}>
    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 35% 50%, ${C.redBright}, ${C.red} 45%, ${C.redDark})`, boxShadow: `0 0 ${80 * glow}px ${20 * glow}px rgba(242,13,47,${0.35 * glow})` }} />
    <div style={{ position: "absolute", top: -size * 0.04, left: size * 0.26, width: size * 0.98, height: size * 0.98, borderRadius: "50%", background: C.night }} />
  </div>
);

const NightGround: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = pop(frame, fps, -6, 20);
  return (
    <Ground>
      <Label>Ground · Night</Label>
      <div style={{ position: "absolute", left: W / 2 - 230, top: 560 - 40 * rise, transform: `rotate(${-8 + 8 * rise}deg)` }}>
        <Crescent size={460} glow={0.6 + 0.4 * rise} />
      </div>
      <div style={{ position: "absolute", top: 1170, width: W, textAlign: "center", fontWeight: 800, fontSize: 84, lineHeight: 1.1 }}>
        the <span style={{ color: C.red }}>night</span> is<br />for everyone
      </div>
      <div style={{ position: "absolute", top: 1420, width: W, textAlign: "center", color: C.muted, fontSize: 24, ...TAGLINE }}>The internet after dark.</div>
    </Ground>
  );
};

const AppCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = (i: number): React.CSSProperties => {
    const p = pop(frame, fps, i * 9 - 4);
    return { position: "absolute", left: 90, width: W - 180, top: 520 + i * 300 + 90 * (1 - p), background: C.card, border: `2px solid ${C.line}`, borderRadius: 28, padding: "30px 36px", boxSizing: "border-box", opacity: Math.min(1, p * 1.6) };
  };
  const xp = interpolate(frame, [30, 70], [0, 490 / 640], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Ground>
      <Label>Ground · App cards</Label>
      <div style={card(0)}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <AppIcon size={84} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 40 }}>こんばんは, Ari</div>
            <div style={{ color: C.muted, fontSize: 28, marginTop: 4 }}>Good evening</div>
          </div>
          <div style={{ border: `2px solid ${C.red}`, color: C.ink, borderRadius: 999, padding: "10px 22px", fontWeight: 700, fontSize: 30 }}>
            <span style={{ fontFamily: EMOJI }}>🔥</span> 1 night
          </div>
        </div>
      </div>
      <div style={card(1)}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 32, fontWeight: 700 }}>
          <span>Lv 4 · Night Owl</span>
          <span style={{ color: C.muted, fontWeight: 600 }}>{Math.round(xp * 640)} / 640 XP</span>
        </div>
        <div style={{ marginTop: 22, height: 16, borderRadius: 16, background: C.card2 }}>
          <div style={{ width: `${xp * 100}%`, height: "100%", borderRadius: 16, background: `linear-gradient(90deg, ${C.redDark}, ${C.red})` }} />
        </div>
      </div>
      <div style={card(2)}>
        <div style={{ fontWeight: 800, fontSize: 36 }}>Tonight&apos;s picks</div>
        <div style={{ display: "flex", gap: 18, marginTop: 22 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, height: 150, borderRadius: 18, background: i === 0 ? `linear-gradient(160deg, ${C.redDark}, ${C.card2})` : C.card2 }} />
          ))}
        </div>
      </div>
    </Ground>
  );
};

const RedFlood: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 70% at 50% 45%, ${C.red} 30%, ${C.redDark} 100%)`, fontFamily: FONT, color: "#000" }}>
      <div style={{ position: "absolute", top: 300, width: W, textAlign: "center", fontSize: 22, color: "rgba(0,0,0,0.6)", ...TAGLINE }}>● Ground · Red flood</div>
      <div style={{ position: "absolute", top: 700, width: W, textAlign: "center", fontWeight: 900, fontSize: 280, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
        {frame < 30 ? "23:59" : "00:00"}
      </div>
      <div style={{ position: "absolute", top: 1060, width: W, textAlign: "center", fontWeight: 800, fontSize: 60 }}>the feed opens at midnight</div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ footage samples
const OnFootage: React.FC<{ t: Take; words: Word[]; style?: CaptionStyle; hook?: HookStyle; children?: React.ReactNode }> = ({ t, words, style, hook, children }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Speaker take={t.take} trimMs={t.trimMs} />
    {children}
    {hook ? <Hook style={hook} lines={["Day 1 of building a", "social media app at 17"]} /> : null}
    {words.length ? <Captions words={words} chunks={t.chunks} trimMs={t.trimMs} fix={t.fix} style={style} /> : null}
  </AbsoluteFill>
);

// split screen: the speaker full frame until `atMs`, then the still in the top half
const Split: React.FC<{ t: Take; words: Word[]; atMs: number; children: React.ReactNode }> = ({ t, words, atMs, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = ms(frame, fps) >= atMs;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Speaker take={t.take} trimMs={t.trimMs} half={on} faceY={t.faceY} />
      {on ? <TopPanel>{children}</TopPanel> : null}
      {words.length ? <Captions words={words} chunks={t.chunks} trimMs={t.trimMs} fix={t.fix} y={(m) => (m - t.trimMs >= atMs ? H / 2 : H * 0.68)} /> : null}
    </AbsoluteFill>
  );
};

const InsertSplit: React.FC<LabProps> = ({ words }) => (
  <Split t={TFEED} words={words} atMs={words.length ? wordAt(TFEED, words, 2) : 0}>
    <Still src="images/optA.png" box={{ x: 50, y: 70, w: W - 100, h: H / 2 - 120 }} />
  </Split>
);

const InsertPair: React.FC<LabProps> = ({ words }) => {
  const box = { y: 120, h: H / 2 - 170, w: (W - 130) / 2 };
  return (
    <Split t={TCTA} words={words} atMs={words.length ? wordAt(TCTA, words, 1) : 0}>
      <Still src="images/optA.png" box={{ x: 50, ...box }} />
      <Still src="images/optB.png" box={{ x: 80 + box.w, ...box }} />
      {/* the images are 1000x880: work out where each one really sits to put its tag on its corner */}
      {[0, 1].map((i) => {
        const s = Math.min(box.w / 1000, box.h / 880);
        const x = 50 + i * (box.w + 30) + (box.w - 1000 * s) / 2;
        const y = box.y + (box.h - 880 * s) / 2;
        return <Tag key={i} letter={i ? "B" : "A"} x={x} y={y - 86} />;
      })}
    </Split>
  );
};

const InsertFull: React.FC<LabProps> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const on = words.length > 0 && ms(frame, fps) >= wordAt(TAPP, words, 2);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Speaker take={TAPP.take} trimMs={TAPP.trimMs} />
      {on ? (
        <AbsoluteFill style={{ background: C.night }}>
          <Still src="brand/screens/1-home.png" box={{ x: 0, y: 0, w: W, h: H }} fit="cover" />
        </AbsoluteFill>
      ) : null}
      {words.length ? <Captions words={words} chunks={TAPP.chunks} trimMs={TAPP.trimMs} fix={TAPP.fix} /> : null}
    </AbsoluteFill>
  );
};

// the corner handle: an Instagram-style glyph and the handle, right side, a quarter down
const Handle: React.FC<LabProps> = ({ words }) => (
  <OnFootage t={TAPP} words={words}>
    <div style={{ position: "absolute", right: 48, top: 470, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT, fontWeight: 700, fontSize: 34, color: "#fff", ...TEXT_ON_VIDEO }}>
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none" />
      </svg>
      @yourhandle
    </div>
  </OnFootage>
);

// the keyword CTA: an app-style comment card, A and B landing on the words
const Cta: React.FC<LabProps> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = ms(frame, fps);
  const at = (i: number) => (words.length ? (wordAt(TCTA, words, i) / 1000) * fps : 0);
  const chip = (letter: string, f: number) => {
    const p = pop(frame, fps, f, 12);
    return frame < f ? null : (
      <div style={{ transform: `scale(${0.6 + 0.4 * p})`, background: C.red, color: "#fff", borderRadius: 999, padding: "8px 34px", fontWeight: 800, fontSize: 46 }}>{letter}</div>
    );
  };
  const p0 = pop(frame, fps, -4);
  return (
    <OnFootage t={TCTA} words={words}>
      <div style={{ position: "absolute", left: 90, right: 90, top: 330 + 60 * (1 - p0), background: C.card, border: `2px solid ${C.line}`, borderRadius: 28, padding: "26px 30px", fontFamily: FONT, color: C.ink, display: "flex", alignItems: "center", gap: 22, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <AppIcon size={76} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 34 }}>Comment your pick</div>
          <div style={{ color: C.muted, fontSize: 26, marginTop: 4 }}>{t < at(7) * (1000 / fps) ? "built tonight" : "built tonight · results tomorrow"}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {chip("A", at(1))}
          {chip("B", at(3))}
        </div>
      </div>
    </OnFootage>
  );
};

// ------------------------------------------------------------------ motion graphics
const NOTES = [
  { who: "YORU · now", what: "Maya pinged everyone: still up?" },
  { who: "YORU · the group chat", what: "6 friends got your ping" },
  { who: "YORU · now", what: "Jay: I'm up 👀" },
];
const Ping: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const press = 1 - 0.1 * Math.max(0, 1 - Math.abs(frame - 8) / 6);
  return (
    <Ground>
      <Label>Motion · Ping</Label>
      {[0, 1, 2].map((r) => {
        const f = frame - 8 - r * 7;
        const k = f < 0 ? 0 : interpolate(f, [0, 34], [0, 1], { extrapolateRight: "clamp" });
        return f < 0 || k >= 1 ? null : (
          <div key={r} style={{ position: "absolute", left: W / 2 - 110, top: 520 - 110, width: 220, height: 220, borderRadius: "50%", border: `4px solid ${C.red}`, transform: `scale(${1 + k * 1.6})`, opacity: 1 - k }} />
        );
      })}
      <div style={{ position: "absolute", left: W / 2 - 110, top: 410, width: 220, height: 220, borderRadius: "50%", background: C.red, transform: `scale(${press})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px rgba(242,13,47,0.45)` }}>
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" /></svg>
      </div>
      <div style={{ position: "absolute", top: 660, width: W, textAlign: "center", fontWeight: 800, fontSize: 40 }}>ping everyone</div>
      {NOTES.map((n, i) => {
        const p = pop(frame, fps, 14 + i * 12);
        return (
          <div key={i} style={{ position: "absolute", left: 80, width: W - 160, top: 790 + i * 190 - 50 * (1 - p), opacity: Math.min(1, p * 2), background: C.card, border: `2px solid ${C.line}`, borderRadius: 30, padding: "26px 30px", boxSizing: "border-box", display: "flex", gap: 24, alignItems: "center" }}>
            <AppIcon size={72} />
            <div>
              <div style={{ color: C.muted, fontSize: 26, fontWeight: 600 }}>{n.who}</div>
              <div style={{ fontWeight: 700, fontSize: 36, marginTop: 4 }}>
                {n.what.replace(" 👀", "")}
                {n.what.includes("👀") ? <span style={{ fontFamily: EMOJI }}> 👀</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </Ground>
  );
};

const Midnight: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = pop(frame, fps, 36, 11);
  const midnight = frame >= 34;
  return (
    <Ground>
      <Label>Motion · Midnight feed</Label>
      <div style={{ position: "absolute", top: 400, width: W, textAlign: "center", fontWeight: 800, fontSize: 220, letterSpacing: "-0.03em", color: midnight ? C.red : C.ink, fontVariantNumeric: "tabular-nums", textShadow: midnight ? "0 0 60px rgba(242,13,47,0.5)" : "none" }}>
        {midnight ? "00:00" : "23:59"}
      </div>
      <svg width="240" height="300" viewBox="0 0 120 150" style={{ position: "absolute", left: W / 2 - 120, top: 700 }}>
        <g transform={`translate(${78 * open * 0.35} ${-22 * open}) rotate(${-28 * open} 86 62)`}>
          <path d="M30 70 V45 a30 30 0 0 1 60 0 V70" fill="none" stroke={C.ink2} strokeWidth="11" strokeLinecap="round" />
        </g>
        <rect x="14" y="66" width="92" height="76" rx="16" fill={C.card} stroke={C.line} strokeWidth="3" />
        <circle cx="60" cy="98" r="9" fill={C.red} />
        <rect x="56" y="100" width="8" height="20" rx="4" fill={C.red} />
      </svg>
      {[0, 1, 2].map((i) => {
        const p = pop(frame, fps, 54 + i * 7);
        return frame < 54 + i * 7 ? null : (
          <div key={i} style={{ position: "absolute", left: 120, width: W - 240, top: 1080 + i * 150 + 80 * (1 - p), height: 120, background: C.card, border: `2px solid ${C.line}`, borderRadius: 24, display: "flex", alignItems: "center", gap: 22, padding: "0 26px", boxSizing: "border-box" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: i === 0 ? C.red : C.card2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 16, width: "70%", background: C.card2, borderRadius: 8 }} />
              <div style={{ height: 14, width: "45%", background: C.card2, borderRadius: 8, marginTop: 14 }} />
            </div>
          </div>
        );
      })}
      {frame >= 54 ? <div style={{ position: "absolute", top: 1550, width: W, textAlign: "center", fontWeight: 800, fontSize: 44 }}>the feed is open</div> : null}
    </Ground>
  );
};

const REACTS = [
  { e: "❤️", t: "heart" },
  { e: "🤡", t: "clown" },
  { e: "💀", t: "skull" },
  { e: "🧢", t: "cap" },
];
const Reactions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hold = interpolate(frame, [0, 28], [0.15, 1], { extrapolateRight: "clamp" });
  const out = frame >= 30;
  const chosen = frame >= 72;
  return (
    <Ground>
      <Label>Motion · Reactions</Label>
      <div style={{ position: "absolute", top: 470, width: W, textAlign: "center", fontWeight: 800, fontSize: 56 }}>
        {out ? <>don&apos;t heart it. <span style={{ color: C.red }}>clown</span> it.</> : "hold the heart"}
      </div>
      {!out ? (
        <div style={{ position: "absolute", left: W / 2 - 150, top: 760, width: 300, height: 300 }}>
          <svg width="300" height="300" viewBox="0 0 100 100" style={{ position: "absolute" }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke={C.line} strokeWidth="4" />
            <circle cx="50" cy="50" r="46" fill="none" stroke={C.red} strokeWidth="4" strokeDasharray={`${hold * 289} 289`} transform="rotate(-90 50 50)" strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 130, fontFamily: EMOJI }}>🤍</div>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 90, width: W - 180, top: 780, height: 230, background: C.card, border: `2px solid ${C.line}`, borderRadius: 999, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {REACTS.map((r, i) => {
            const p = pop(frame, fps, 30 + i * 4, 11);
            const pick = chosen && i === 1;
            return (
              <div key={r.t} style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${50 * (1 - p)}px) scale(${(0.5 + 0.5 * p) * (pick ? 1.25 : 1)})` }}>
                <div style={{ width: 150, height: 150, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: EMOJI, fontSize: 96, background: pick ? "rgba(242,13,47,0.18)" : "transparent", boxShadow: pick ? `0 0 0 5px ${C.red}` : "none" }}>{r.e}</div>
              </div>
            );
          })}
        </div>
      )}
      {out ? (
        <div style={{ position: "absolute", left: 90, width: W - 180, top: 1040, display: "flex", justifyContent: "space-around", color: C.muted, fontSize: 30, fontWeight: 600 }}>
          {REACTS.map((r, i) => <span key={r.t} style={{ width: 150, textAlign: "center", color: chosen && i === 1 ? C.ink : C.muted }}>{r.t}</span>)}
        </div>
      ) : null}
    </Ground>
  );
};

const Stacks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const col = (x: number, label: string, side: number) => (
    <>
      {[0, 1, 2, 3, 4].map((i) => {
        const f = 4 + i * 14 + side * 7;
        const p = pop(frame, fps, f, 13);
        return frame < f ? null : (
          <div key={i} style={{ position: "absolute", left: x, top: 1330 - (i + 1) * 128 - 240 * (1 - p), width: 300, height: 116 }}>
            <div style={{ position: "absolute", inset: 0, background: side ? C.card2 : C.card, border: `2px solid ${C.line}`, borderRadius: 14 }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 22, borderRadius: "14px 14px 0 0", background: side ? "#242424" : "#1d1d1d" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: x, width: 300, top: 1360, textAlign: "center" }}>
        <span style={{ display: "inline-block", background: side ? C.red : C.card, border: `2px solid ${side ? C.red : C.line}`, borderRadius: 999, padding: "8px 30px", fontWeight: 800, fontSize: 36 }}>{label}</span>
      </div>
    </>
  );
  const done = frame >= 4 + 4 * 14 + 7 + 10;
  return (
    <Ground>
      <Label>Motion · Same reach</Label>
      <div style={{ position: "absolute", top: 420, width: W, textAlign: "center", color: C.ink2, fontSize: 40, fontWeight: 700 }}>reach per post</div>
      {col(150, "paid", 0)}
      {col(630, "free", 1)}
      {done ? <div style={{ position: "absolute", left: 150, width: 780, top: 1330 - 5 * 128 - 30, borderTop: `4px dashed ${C.red}` }} /> : null}
      {done ? <div style={{ position: "absolute", top: 1500, width: W, textAlign: "center", fontWeight: 800, fontSize: 60 }}>same reach for everyone</div> : null}
    </Ground>
  );
};

const STEPS = [40, 36, 33, 30, 27, 24, 21, 19, 17];
const Countdown: React.FC = () => {
  const frame = useCurrentFrame();
  const n = STEPS[Math.min(STEPS.length - 1, Math.floor(frame / 10))];
  const last = n === 17;
  return (
    <Ground>
      <div style={{ position: "absolute", top: 330, width: W, textAlign: "center", fontWeight: 700, fontSize: 58, lineHeight: 1.25, color: "#fff", ...TEXT_ON_VIDEO }}>
        my reaction to the age<br />you build your first app
      </div>
      <div style={{ position: "absolute", top: 700, width: W, textAlign: "center", fontWeight: 900, fontSize: 420, letterSpacing: "-0.04em", lineHeight: 1, color: last ? C.red : C.ink, fontVariantNumeric: "tabular-nums", textShadow: last ? "0 0 80px rgba(242,13,47,0.5)" : "none" }}>{n}</div>
      <div style={{ position: "absolute", top: 1450, width: W, textAlign: "center", color: C.muted, fontSize: 24, ...TAGLINE }}>● Motion · Countdown (the trend format)</div>
    </Ground>
  );
};

// ------------------------------------------------------------------ the list
export type Sample = { id: string; group: string; title: string; about: string; frames: number; take?: string; C: React.FC<LabProps> };
const foot = (t: Take, style?: CaptionStyle, hook?: HookStyle): React.FC<LabProps> => {
  const F: React.FC<LabProps> = ({ words }) => <OnFootage t={t} words={words} style={style} hook={hook} />;
  return F;
};

export const SAMPLES: Sample[] = [
  { id: "01", group: "Grounds and colour", title: "Night", about: "The app's #080808 night with the logo's red crescent rising in. The slogan sits under it.", frames: 105, C: NightGround },
  { id: "02", group: "Grounds and colour", title: "App cards", about: "Graphics built from YORU's own cards: #121212 on the night, hairline edges, the 1-night chip and the XP bar.", frames: 105, C: AppCards },
  { id: "03", group: "Grounds and colour", title: "Red flood", about: "A full YORU-red ground with black type, for one big moment like midnight. Never over footage.", frames: 75, C: RedFlood },
  { id: "04", group: "Hooks", title: "Hook: white boxes", about: "Black Inter on white boxes, the current default. Moved to 16% down so the grid crop keeps it.", frames: T17.frames, take: T17.take, C: foot(T17, "underline", "white") },
  { id: "05", group: "Hooks", title: "Hook: black boxes", about: "White Inter on black boxes. Darker and quieter; reads on a bright wall.", frames: T17.frames, take: T17.take, C: foot(T17, "underline", "black") },
  { id: "06", group: "Hooks", title: "Hook: plain white", about: "White text with a soft shadow, no box. The most native-looking, the least contrast.", frames: T17.frames, take: T17.take, C: foot(T17, "underline", "plain") },
  { id: "07", group: "Captions", title: "Underline (current)", about: "White Inter 800, 1-3 words, a red underline under the keyword. What Day 1 used, in YORU red.", frames: TPING.frames, take: TPING.take, C: foot(TPING, "underline") },
  { id: "08", group: "Captions", title: "Red word", about: "The keyword itself turns YORU red (the brighter #FF3355 so it reads on skin). No underline.", frames: TPING.frames, take: TPING.take, C: foot(TPING, "red") },
  { id: "09", group: "Captions", title: "Classic outline", about: "Thick black outline, no shadow, red underline. The loudest; holds up on any background.", frames: TPING.frames, take: TPING.take, C: foot(TPING, "outline") },
  { id: "10", group: "Captions", title: "Red pill", about: "The keyword sits on a red pill, like the app's buttons and chat bubbles.", frames: TPING.frames, take: TPING.take, C: foot(TPING, "pill") },
  { id: "11", group: "Inserts", title: "Split screen", about: "The screen cuts in on \"feed\": top half, straight, on the app's card colour. You stay in the bottom half; the caption sits on the seam.", frames: TFEED.frames, take: TFEED.take, C: InsertSplit },
  { id: "12", group: "Inserts", title: "A/B pair", about: "Both options side by side from \"A\", tagged with square red tags.", frames: TCTA.frames, take: TCTA.take, C: InsertPair },
  { id: "13", group: "Inserts", title: "Full-screen app", about: "On \"app\", a real YORU screen takes the whole frame; captions stay on top.", frames: TAPP.frames, take: TAPP.take, C: InsertFull },
  { id: "14", group: "Motion graphics", title: "Ping", about: "The ping button fires and notification cards drop in, in the app's own style.", frames: 105, C: Ping },
  { id: "15", group: "Motion graphics", title: "Midnight unlock", about: "23:59 cuts to a red 00:00, the lock opens, the feed rises.", frames: 105, C: Midnight },
  { id: "16", group: "Motion graphics", title: "Reactions", about: "Hold the heart and the picker opens: heart, clown, skull, cap. Clown gets picked.", frames: 105, C: Reactions },
  { id: "17", group: "Motion graphics", title: "Same reach", about: "Paid and free posts stack block by block to the same height.", frames: 105, C: Stacks },
  { id: "18", group: "Motion graphics", title: "Countdown", about: "For the reaction trend: the number cuts down to 17 and turns red. Your reactions would be filmed under it.", frames: 120, C: Countdown },
  { id: "19", group: "Brand moments", title: "Corner handle", about: "Instagram glyph and your handle, right side, a quarter down. @yourhandle until you send the real one.", frames: TAPP.frames, take: TAPP.take, C: Handle },
  { id: "20", group: "Brand moments", title: "Keyword CTA", about: "An app-style card for the ending: A and B pop in on the words as you say them.", frames: TCTA.frames, take: TCTA.take, C: Cta },
];
