"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/client/api";
import { onYoruApp, yoruApp } from "@/lib/client/push";

// Microphone recording for Atlas. The clip goes to the server as-is (WebM on
// Chrome/Android, MP4 on Safari, Ogg on Firefox): Gemini understands it
// directly, so there's no separate transcription step. The live input level
// is written to a ref (not state) so the orb can animate without re-rendering
// the page 60 times a second.
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function useRecorder(maxSeconds: number) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const level = useRef(0);
  const rec = useRef<MediaRecorder | null>(null);
  const done = useRef<((b: Blob | null) => void) | null>(null);
  const cleanup = useRef<() => void>(() => {});
  // Called with the clip when recording stops on its own (time limit).
  const onAutoStop = useRef<((b: Blob | null) => void) | null>(null);
  const cancelled = useRef(false);

  const stop = useCallback(() => {
    return new Promise<Blob | null>((resolve) => {
      if (!rec.current || rec.current.state === "inactive") return resolve(null);
      done.current = resolve;
      rec.current.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    done.current = null;
    cancelled.current = true;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (rec.current?.state === "recording") return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new ApiError("UNSUPPORTED", "This browser can't record audio. Try typing, or attach an audio file.", 0);
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }).catch(() => {
      throw new ApiError("MIC_BLOCKED", "Atlas needs microphone access. Allow it in your browser's site settings.", 0);
    });
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
    const parts: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && parts.push(e.data);

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      level.current = Math.min(1, peak / 64);
      raf = requestAnimationFrame(tick);
    };
    tick();
    const began = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (s >= maxSeconds && r.state === "recording") r.stop();
    }, 250);

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      level.current = 0;
    };
    r.onstop = () => {
      cleanup.current();
      setRecording(false);
      const blob = parts.length ? new Blob(parts, { type: (r.mimeType || mimeType || "audio/webm").split(";")[0] }) : null;
      const cb = done.current;
      done.current = null;
      if (cancelled.current) return;
      // Auto-stop at the time limit still hands the clip over.
      (cb ?? onAutoStop.current)?.(blob && blob.size > 1200 ? blob : null);
    };
    rec.current = r;
    cancelled.current = false;
    r.start(250);
    setSeconds(0);
    setRecording(true);
  }, [maxSeconds]);

  useEffect(() => () => {
    done.current = null;
    cancelled.current = true;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    cleanup.current();
  }, []);

  return { recording, seconds, level, start, stop, cancel, onAutoStop };
}

// Spoken replies with the device's own voices (no extra API calls). Long
// replies are split into sentences: some browsers cut off long utterances.
// In the Android app (no speechSynthesis in its WebView) the phone speaks.
export function useSpeech() {
  const [speaking, setSpeaking] = useState<string | null>(null);
  const app = yoruApp();
  const supported = typeof window !== "undefined" && (Boolean(app) || "speechSynthesis" in window);

  const stop = useCallback(() => {
    if (app) app.stopSpeaking();
    else if (supported) window.speechSynthesis.cancel();
    setSpeaking(null);
  }, [app, supported]);

  const speak = useCallback((id: string, text: string) => {
    if (!supported || !text) return;
    const lang = document.documentElement.lang || navigator.language || "en";
    if (app) {
      app.speak(text, lang, 1.04, id);
      setSpeaking(id);
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    const voice = voices.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) ?? voices[0];
    const parts = text.match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      if (voice) u.voice = voice;
      u.rate = 1.04;
      if (i === parts.length - 1) u.onend = () => setSpeaking((s) => (s === id ? null : s));
      u.onerror = () => setSpeaking((s) => (s === id ? null : s));
      synth.speak(u);
    });
    setSpeaking(id);
  }, [app, supported]);

  useEffect(() => {
    if (!app) return;
    return onYoruApp((e) => {
      if (e.type === "speech" && e.state !== "start") setSpeaking((s) => (s === e.id || !e.id ? null : s));
    });
  }, [app]);
  useEffect(() => () => { if (app) app.stopSpeaking(); else if (supported) window.speechSynthesis.cancel(); }, [app, supported]);
  return { speaking, speak, stop, supported };
}
