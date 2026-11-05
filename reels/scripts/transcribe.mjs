#!/usr/bin/env node
// Word-level transcript of a take, with whisper.cpp.
//
//   node scripts/transcribe.mjs public/recordings/take.mp4 [out.json] [--force]
//
// Writes [{ text, startMs, endMs }, ...], one entry per spoken word, to out.json
// (default: next to the video as <name>.words.json). Punctuation stays attached to
// its word ("app."), and non-speech tags like [BLANK_AUDIO] are dropped.
//
// It refuses to overwrite an existing transcript without --force: whisper jitters
// between runs, so re-transcribing an unchanged take moves every anchored beat.
//
// Needs ffmpeg on PATH and whisper.cpp built in bin/whisper.cpp (npm run setup:whisper).
// WHISPER_MODEL overrides the model (default bin/whisper.cpp/models/ggml-base.en.bin).

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WHISPER = join(ROOT, "bin/whisper.cpp");
const CLI = join(WHISPER, "build/bin/whisper-cli");
const MODEL = process.env.WHISPER_MODEL ? resolve(process.env.WHISPER_MODEL) : join(WHISPER, "models/ggml-base.en.bin");

const args = process.argv.slice(2);
const force = args.includes("--force");
const [input, output] = args.filter((a) => a !== "--force");
if (!input) {
  console.error("usage: node scripts/transcribe.mjs <video.mp4> [out.json] [--force]");
  process.exit(1);
}
const src = resolve(input);
const out = output ? resolve(output) : join(dirname(src), `${basename(src, extname(src))}.words.json`);

const fail = (msg) => {
  console.error(`transcribe: ${msg}`);
  process.exit(1);
};
if (!existsSync(src)) fail(`no such file: ${src}`);
if (!existsSync(CLI)) fail(`whisper.cpp is not built (${CLI}); run npm run setup:whisper`);
if (!existsSync(MODEL)) fail(`model not found: ${MODEL}`);
if (existsSync(out) && !force) fail(`${out} exists; pass --force to re-transcribe (beats anchored to it will move)`);

const run = (cmd, argv) => {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.error) fail(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} exited ${r.status}\n${(r.stderr || "").slice(-2000)}`);
  return r;
};

const tmp = mkdtempSync(join(tmpdir(), "transcribe-"));
try {
  // whisper.cpp wants 16 kHz mono 16-bit PCM; the same samples also go to a raw file for the
  // silence check below
  const wav = join(tmp, "audio.wav");
  const pcm = join(tmp, "audio.pcm");
  run("ffmpeg", ["-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
    "-c:a", "pcm_s16le", wav, "-f", "s16le", "-ac", "1", "-ar", "16000", pcm]);

  // -ojf: full JSON with per-token times. --dtw aligns tokens to the audio with cross-attention
  // (it needs flash attention off, -nfa, or whisper.cpp silently skips it).
  const base = join(tmp, "whisper");
  const m = /ggml-((?:tiny|base|small|medium|large-v\d(?:-turbo)?)(?:\.en)?)/.exec(basename(MODEL));
  const dtw = m ? m[1].replace(/-/g, ".") : null; // large-v3-turbo -> large.v3.turbo
  run(CLI, [
    "-m", MODEL, "-f", wav, "-l", "en", "-t", String(Math.max(1, cpus().length)),
    "-ojf", "-of", base, "-np", ...(dtw ? ["--dtw", dtw, "-nfa"] : []),
  ]);
  const json = JSON.parse(readFileSync(`${base}.json`, "utf8"));

  // 10 ms loudness frames, and what counts as quiet for this take
  const buf = readFileSync(pcm);
  const samples = new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1);
  const rms = [];
  for (let i = 0; i + 160 <= samples.length; i += 160) {
    let e = 0;
    for (let j = i; j < i + 160; j++) e += samples[j] * samples[j];
    rms.push(Math.sqrt(e / 160));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const quiet = Math.max(300, (sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 0.12);
  // voice, not a key click: the 50 ms from here on are loud on average
  const loud = (ms) => {
    const i = Math.floor(ms / 10);
    let e = 0;
    for (let j = i; j < i + 5; j++) e += rms[j] ?? 0;
    return e / 5 >= quiet;
  };

  // tokens -> words. A token that starts with a space starts a new word; word pieces and
  // punctuation join the word before. Times: whisper.cpp stamps each token's t_dtw where the
  // alignment moves on to the next token, i.e. at the token's END, so a token starts at the
  // previous token's t_dtw (measured against faster-whisper: 70 ms mean error mid-speech vs
  // 300 ms for the default timestamps). Without DTW, fall back to the default offsets.
  const words = [];
  let prevEnd = null;
  let open = ""; // an opening quote or bracket waiting for the word it belongs to
  for (const seg of json.transcription ?? []) {
    for (const tk of seg.tokens ?? []) {
      const text = tk.text ?? "";
      if (!text.trim() || text.startsWith("[_")) continue; // [_BEG_], [_TT_n] and other specials
      const end = tk.t_dtw >= 0 ? tk.t_dtw * 10 : tk.offsets.to; // t_dtw is in 10 ms steps
      const start = tk.t_dtw >= 0 && prevEnd !== null ? prevEnd : tk.offsets.from;
      prevEnd = tk.t_dtw >= 0 ? end : null;
      const last = words[words.length - 1];
      const punct = !/[\p{L}\p{N}]/u.test(text);
      if (punct && text.startsWith(" ") && /^["'“‘(\[¿¡]+$/.test(text.trim())) {
        open += text.trim();
      } else if (last && !open && (!text.startsWith(" ") || punct)) {
        last.text += text.trim();
        last.endMs = Math.max(last.endMs, end);
      } else {
        words.push({ text: open + text.trim(), startMs: start, endMs: Math.max(start, end) });
        open = "";
      }
    }
  }

  const clean = words.filter((w) => /[\p{L}\p{N}]/u.test(w.text) && !/^[[(].*[\])]$/.test(w.text)); // [BLANK_AUDIO], (music)
  for (let i = 0; i < clean.length; i++) {
    const w = clean[i];
    // a word never starts before the one ahead of it
    if (i > 0) w.startMs = Math.max(w.startMs, clean[i - 1].startMs);
    w.endMs = Math.max(w.endMs, w.startMs);
    // after a pause the alignment hands the silence to one side or the other: move the start
    // forward to where the voice comes in, and the end back to where it stops. Each keeps at
    // least 60 ms of the word, so a word too quiet to measure stays where whisper put it.
    while (w.startMs + 60 <= w.endMs && !loud(w.startMs)) w.startMs += 10;
    while (w.endMs - 60 >= w.startMs && !loud(w.endMs - 50)) w.endMs -= 10;
  }
  const result = clean.map((w) => ({ text: w.text, startMs: Math.round(w.startMs), endMs: Math.round(w.endMs) }));

  writeFileSync(out, JSON.stringify(result, null, 1) + "\n");
  const secs = result.length ? (result[result.length - 1].endMs / 1000).toFixed(1) : "0";
  console.log(`wrote ${out}: ${result.length} words, ${secs}s`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
