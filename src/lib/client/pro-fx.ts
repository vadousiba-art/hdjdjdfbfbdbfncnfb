"use client";

import type { SoundP, ThemeP } from "@/lib/pro/catalog";

// Theme Forge+: a theme sets the whole palette as CSS variables on <html>.
// Removing it restores the member's own light/dark choice and colour.
const VARS: [keyof ThemeP, string][] = [
  ["bg", "--bg"], ["bg2", "--bg-2"], ["card", "--card"], ["card2", "--card-2"], ["line", "--line"],
  ["ink", "--ink"], ["ink2", "--ink-2"], ["muted", "--muted"],
];
let saved: { theme?: string; hue: string } | null = null;

export function applyTheme(t: ThemeP | null) {
  const root = document.documentElement;
  if (!t) {
    if (!saved) return;
    for (const [, v] of VARS) root.style.removeProperty(v);
    if (saved.theme) root.dataset.theme = saved.theme;
    if (saved.hue) root.style.setProperty("--accent-h", saved.hue);
    else root.style.removeProperty("--accent-h");
    delete root.dataset.proTheme;
    saved = null;
    return;
  }
  if (!saved) saved = { theme: root.dataset.theme, hue: root.style.getPropertyValue("--accent-h") };
  root.dataset.theme = t.mode;
  root.dataset.proTheme = "on";
  for (const [k, v] of VARS) root.style.setProperty(v, String(t[k]));
  root.style.setProperty("--accent-h", String(t.hue));
}

// Notification sounds, synthesized (original, no audio files). Nothing plays
// unless the member picked a sound and turned sounds on, or taps Preview.
let ctx: AudioContext | null = null;
export function playSound(p: SoundP, volume = 60) {
  if (!p.notes.length && !p.noise) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    out.gain.value = Math.max(0, Math.min(1, volume / 100)) * p.gain;
    let node: AudioNode = out;
    if (p.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = p.lp;
      out.connect(f);
      node = f;
    }
    node.connect(ctx.destination);
    if (p.echo) {
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.16;
      const fb = ctx.createGain();
      fb.gain.value = p.echo;
      node.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(ctx.destination);
      setTimeout(() => fb.disconnect(), 1800);
    }
    for (const [freq, start, dur] of p.notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = p.wave;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(1, t0 + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + start + dur);
      o.connect(g).connect(out);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.05);
    }
    if (p.noise) {
      const len = Math.floor(ctx.sampleRate * 0.25);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = p.noise;
      src.buffer = buf;
      src.connect(g).connect(out);
      src.start(t0);
    }
  } catch {
    /* audio not available */
  }
}
