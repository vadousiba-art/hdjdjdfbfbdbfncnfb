// Building blocks for the Brand Lab samples: the speaker, captions, the hook, inserts and tags.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, KANJI, TAGLINE, TEXT_ON_VIDEO } from "../shared/theme";

export type Word = { text: string; startMs: number; endMs: number };
// a caption chunk: word indexes [from, to] (inclusive) and the keyword index, if any
export type Chunk = { from: number; to: number; key?: number };
export type CaptionStyle = "underline" | "red" | "outline" | "pill";

export const W = 1080;
export const H = 1920;

// ------------------------------------------------------------------ the speaker
export const Speaker: React.FC<{ take: string; trimMs: number; half?: boolean; faceY?: number }> = ({ take, trimMs, half, faceY = 0.42 }) => {
  const { fps } = useVideoConfig();
  const video = (
    <OffthreadVideo
      src={staticFile(`recordings/${take}.mp4`)}
      trimBefore={Math.round((trimMs / 1000) * fps)}
      style={half ? { position: "absolute", left: 0, top: H * 0.25 - faceY * H, width: W, height: H } : { width: W, height: H, objectFit: "cover" }}
    />
  );
  if (!half) return <AbsoluteFill>{video}</AbsoluteFill>;
  // bottom half only, with the face centred in it
  return (
    <div style={{ position: "absolute", left: 0, top: H / 2, width: W, height: H / 2, overflow: "hidden" }}>{video}</div>
  );
};

// ------------------------------------------------------------------ captions
const caseOf = (t: string) => (/^[A-Z]:?$/.test(t) || /^[A-Z]{2,}/.test(t) || /^\d/.test(t) ? t : t.toLowerCase());

export const Captions: React.FC<{
  words: Word[];
  chunks: Chunk[];
  trimMs: number;
  style?: CaptionStyle;
  y?: (ms: number) => number; // the line's centre for a given time (moves to the seam during a split)
  fix?: Record<number, string>; // word fixes, keyed by index (never by time)
  size?: number;
}> = ({ words, chunks, trimMs, style = "underline", y = () => H * 0.68, fix = {}, size = 66 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000 + trimMs;
  const text = (i: number) => caseOf(fix[i] ?? words[i].text);
  const live = chunks.find((c, n) => {
    const next = chunks[n + 1];
    const s = words[c.from].startMs - 20;
    const e = words[c.to].endMs;
    const end = next ? Math.min(words[next.from].startMs - 20, words[next.from].startMs - e < 250 ? words[next.from].startMs : e + 100) : e + 300;
    return ms >= s && ms < end;
  });
  if (!live) return null;
  const outline = style === "outline";
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: y(ms) - size * 0.6, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.2, color: "#fff", whiteSpace: "nowrap" }}>
      {Array.from({ length: live.to - live.from + 1 }, (_, k) => {
        const i = live.from + k;
        const key = i === live.key;
        const base: React.CSSProperties = outline
          ? { WebkitTextStroke: "11px #000", paintOrder: "stroke fill" }
          : TEXT_ON_VIDEO;
        const look: React.CSSProperties =
          key && style === "red" ? { color: C.redBright } :
          key && style === "pill" ? { background: C.red, borderRadius: 16, padding: "0 16px", textShadow: "none", WebkitTextStroke: "0px transparent", boxShadow: "0 6px 20px rgba(0,0,0,0.35)" } : {};
        return (
          <React.Fragment key={i}>
            {k > 0 ? " " : null}
            <span style={{ position: "relative", display: "inline-block", ...base, ...look }}>
              {text(i)}
              {key && (style === "underline" || style === "outline") ? (
                <span style={{ position: "absolute", left: 0, right: /[.,!?:]$/.test(text(i)) ? size * 0.22 : 0, top: size * 1.12, height: size * 0.11, borderRadius: size, background: C.red, boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
              ) : null}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ------------------------------------------------------------------ the hook
export type HookStyle = "white" | "black" | "plain";
export const Hook: React.FC<{ lines: string[]; style?: HookStyle; top?: number }> = ({ lines, style = "white", top = 300 }) => (
  <div style={{ position: "absolute", left: 0, width: W, top, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontFamily: FONT, fontWeight: 600, fontSize: 58, lineHeight: 1.22 }}>
    {lines.map((l) => (
      <span
        key={l}
        style={
          style === "plain"
            ? { color: "#fff", ...TEXT_ON_VIDEO, textShadow: "0 3px 14px rgba(0,0,0,0.85)" }
            : { background: style === "white" ? "#fff" : "#000", color: style === "white" ? "#000" : "#fff", padding: "4px 22px 8px", borderRadius: 6 }
        }
      >
        {l}
      </span>
    ))}
  </div>
);

// ------------------------------------------------------------------ inserts (straight, square, still)
export const TopPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H / 2, background: C.card }}>{children}</div>
);

export const Still: React.FC<{ src: string; box: { x: number; y: number; w: number; h: number }; fit?: "contain" | "cover" }> = ({ src, box, fit = "contain" }) => (
  <Img src={staticFile(src)} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, objectFit: fit }} />
);

// the square A/B tag
export const Tag: React.FC<{ letter: string; x: number; y: number }> = ({ letter, x, y }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 76, height: 76, background: C.red, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>{letter}</div>
);

// the small label at the top of a motion sample ("MOTION · PING")
export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", top: 300, width: W, textAlign: "center", color: C.muted, fontSize: 22, ...TAGLINE }}>
    <span style={{ color: C.red }}>●</span> {children}
  </div>
);

// the red 夜 app icon, as on YORU's notifications
export const AppIcon: React.FC<{ size?: number }> = ({ size = 64 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.24, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: KANJI, fontWeight: 900, fontSize: size * 0.6, flex: "none" }}>夜</div>
);

export const Ground: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 80% at 50% 30%, ${C.night2} 0%, ${C.night} 70%)`, fontFamily: FONT, color: C.ink }}>{children}</AbsoluteFill>
);
