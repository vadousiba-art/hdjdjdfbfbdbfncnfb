// The motivation reel ("Nobody's coming"), in the look of the creator's best video: one
// talking shot, and the words stacking up as they're said (small connector lines, big
// key lines, one YORU-red word per block). Words never move: each one appears on the
// frame it's spoken and goes from grey to white in 4 frames. The beat stops dead after the
// last word; on the boom it cuts to black with the last block and the CTA. The audio is one
// pre-mixed track (voice + the reference's piano loop), so the video itself is muted.
import React from "react";
import { AbsoluteFill, Audio, CalculateMetadataFunction, Composition, continueRender, delayRender, Folder, interpolateColors, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { C, loadBrandFonts } from "../shared/theme";
import { Block, CARD_SECONDS, HANDLE, VERSIONS } from "./versions";

const W = 1080;
const H = 1920;
const FPS = 30;
const LEFT = 64;
const TOP = 1000;          // the stack starts below the chin, over the dark torso and desk (measured)
const MAX_W = W - LEFT - 76;
const SIZE = { s: { max: 66, weight: 800, spacing: "-0.01em", lh: 1.1 }, b: { max: 150, weight: 900, spacing: "-0.04em", lh: 0.95 } };
const GREY = "#8C8C8C";

const fonts = delayRender("brand fonts");
loadBrandFonts().then(() => continueRender(fonts));

type EditWord = { seg: number; i: number; text: string; startMs: number; endMs: number };
type Edit = { fps: number; frames: number; durationMs: number; words: EditWord[] };
type Props = { version: string; edit: Edit | null; sizes: number[][] };

const frameOf = (ms: number) => Math.floor((ms * FPS) / 1000);

function startOf(edit: Edit, seg: number, i: number, text: string) {
  const hit = edit.words.find((x) => x.seg === seg && x.i === i);
  if (!hit) throw new Error(`word ${text} (segment ${seg}, #${i}) is not in this version's edit.json`);
  return hit.startMs;
}

const IgIcon: React.FC = () => (
  <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth={2.2}>
    <rect x={3} y={3} width={18} height={18} rx={5} />
    <circle cx={12} cy={12} r={4} />
    <circle cx={17.3} cy={6.7} r={1.1} fill={C.ink} stroke="none" />
  </svg>
);

const SHADOW = "0 4px 18px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.5)";

const Stack: React.FC<{ block: Block; sizes: number[]; edit: Edit; frame: number }> = ({ block, sizes, edit, frame }) => (
  <div style={{ position: "absolute", left: LEFT, top: TOP, fontFamily: "Inter", textTransform: "uppercase", textShadow: SHADOW }}>
    {block.map((line, k) => {
      const st = SIZE[line.size];
      return (
        <div key={k} style={{ fontSize: sizes[k], fontWeight: st.weight, letterSpacing: st.spacing, lineHeight: st.lh, whiteSpace: "nowrap" }}>
          {line.words.map((word, j) => {
            const at = frameOf(startOf(edit, word.seg, word.i, word.text));
            if (frame < at) return null;
            const to = word.red ? C.redBright : C.ink;
            const color = interpolateColors(frame - at, [0, 4], [GREY, to]);
            return (
              <span key={j} style={{ color }}>
                {j > 0 ? " " : ""}
                {word.text}
              </span>
            );
          })}
        </div>
      );
    })}
  </div>
);

const Reel: React.FC<Props> = ({ version, edit, sizes }) => {
  const frame = useCurrentFrame();
  if (!edit) return null;
  const v = VERSIONS.find((x) => x.id === version)!;
  const starts = v.blocks.map((blk) => frameOf(startOf(edit, blk[0].words[0].seg, blk[0].words[0].i, blk[0].words[0].text)));
  // the block on screen: the latest one that has started (the last one stays to the end)
  let now = -1;
  starts.forEach((f, k) => {
    if (frame >= f) now = k;
  });
  const card = frame >= edit.frames;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence durationInFrames={edit.frames} premountFor={0}>
        <AbsoluteFill>
          <OffthreadVideo src={staticFile(`recordings/motivation/${version}/aroll.mp4`)} muted style={{ width: W, height: H }} />
        </AbsoluteFill>
      </Sequence>
      {/* voice + the reference piano, pre-mixed and peak-limited by scripts/motivation-music.py */}
      <Audio src={staticFile(`recordings/motivation/${version}/mix.wav`)} />
      {now >= 0 ? <Stack block={v.blocks[now]} sizes={sizes[now]} edit={edit} frame={frame} /> : null}
      {card ? (
        <div style={{ position: "absolute", left: LEFT, top: TOP + 300, fontFamily: "Inter", textTransform: "uppercase", color: C.ink, textShadow: SHADOW }}>
          <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            COMMENT <span style={{ color: C.redBright }}>&quot;NIGHT&quot;</span>
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "0", lineHeight: 1.3, color: C.ink2 }}>AND I&apos;LL SEND YOU WHAT I&apos;M BUILDING</div>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: LEFT, top: 196, display: "flex", alignItems: "center", gap: 14, fontFamily: "Inter", fontWeight: 700, fontSize: 34, color: C.ink, textShadow: SHADOW }}>
        <IgIcon />
        {HANDLE}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ registration
// Line sizes are measured here, after the brand font has loaded: each line gets the largest
// size up to its maximum that fits the stack's width.
const meta: CalculateMetadataFunction<Props> = async ({ props }) => {
  await loadBrandFonts();
  const res = await fetch(staticFile(`recordings/motivation/${props.version}/edit.json`));
  const edit: Edit = await res.json();
  const v = VERSIONS.find((x) => x.id === props.version)!;
  const sizes = v.blocks.map((blk) =>
    blk.map((line) => {
      const st = SIZE[line.size];
      const text = line.words.map((x) => x.text).join(" ");
      const fit = fitText({ text, withinWidth: MAX_W, fontFamily: "Inter", fontWeight: st.weight, letterSpacing: st.spacing, textTransform: "uppercase" });
      return Math.min(st.max, Math.floor(fit.fontSize));
    }),
  );
  return { durationInFrames: edit.frames + Math.round(CARD_SECONDS * FPS), props: { ...props, edit, sizes } };
};

export const Motivation: React.FC = () => (
  <Folder name="Motivation">
    {VERSIONS.map((v) => (
      <Composition key={v.id} id={`Motivation-${v.id}`} component={Reel} durationInFrames={700} fps={FPS} width={W} height={H}
        defaultProps={{ version: v.id, edit: null, sizes: [] }} calculateMetadata={meta} />
    ))}
  </Folder>
);
