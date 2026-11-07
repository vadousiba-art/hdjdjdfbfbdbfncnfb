"use client";

/* eslint-disable @next/next/no-img-element -- local previews of the member's own picks (blob: URLs) */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import useSWR from "swr";
import { AudioLines, Check, ChevronDown, Copy, ImagePlus, Mic, RotateCcw, Send, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { AtlasOrb, type OrbState } from "@/components/atlas/AtlasOrb";
import { ModelPicker } from "@/components/atlas/ModelPicker";
import { Reply } from "@/components/atlas/Reply";
import { useRecorder, useSpeech } from "@/components/atlas/hooks";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { ChaosLoader } from "@/components/ui/bits";
import { ATLAS_LIMITS } from "@/lib/atlas/models";
import { ApiError } from "@/lib/client/api";
import { chat, clearAtlas, loadAtlas, prepareFile, savePrefs, speakable, tooBig, type Outgoing, type StreamEvent } from "@/lib/client/atlas";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  note?: string;
  files?: { kind: string; preview?: string; name: string }[];
  attachments?: string[];
  streaming?: boolean;
  error?: string;
  retry?: Payload;
};
type Payload = { text: string; voice?: boolean; attachments: Outgoing[] };

const SUGGESTIONS = [
  "Write a post about the anime I'm watching",
  "Help me write a better bio",
  "What's trending on YORU tonight?",
  "How does Night Watch keep YORU safe?",
  "Explain this like I'm new: recursion",
  "Give me 3 caption ideas for a night-sky photo",
];
const uid = () => Math.random().toString(36).slice(2);

export default function AtlasPage() {
  const { me } = useShell();
  const { toastError } = useApp();
  const { data, error, mutate } = useSWR("atlas", loadAtlas, { revalidateOnFocus: false });
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Outgoing[]>([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const rec = useRecorder(ATLAS_LIMITS.voiceSeconds);
  const voice = useSpeech();

  // History arrives once with the page data; after that the page owns it.
  if (data && msgs === null) {
    setMsgs(data.history.map((h) => ({ id: h.id, role: h.role, content: h.content, model: h.model, attachments: h.attachments })));
  }
  const model = data?.models.find((m) => m.id === data.model);
  const speakOn = data?.speak ?? false;

  const count = msgs?.length ?? 0;
  const lastLength = msgs?.[count - 1]?.content.length ?? 0;
  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count, lastLength]);

  useEffect(() => () => abort.current?.abort(), []);

  const streamingNow = msgs?.some((m) => m.streaming) ?? false;
  const waiting = msgs?.some((m) => m.streaming && !m.content) ?? false;
  const orb: OrbState = rec.recording ? "listening" : waiting ? "thinking" : voice.speaking ? "speaking" : streamingNow ? "thinking" : "idle";

  async function run(p: Payload, replaceId?: string) {
    if (!data || busy) return;
    if (!model) {
      setPicking(true);
      return;
    }
    voice.stop();
    setBusy(true);
    const user: Msg = {
      id: uid(),
      role: "user",
      content: p.text || (p.voice ? "🎤 Voice message" : p.attachments.some((a) => a.kind === "image") ? "🖼 Sent an image" : "🎧 Sent audio"),
      files: p.attachments.map((a) => ({ kind: a.voice ? "voice" : a.kind, preview: a.preview, name: a.name })),
    };
    const reply: Msg = { id: uid(), role: "assistant", content: "", streaming: true, retry: p };
    setMsgs((cur) => {
      const base = (cur ?? []).filter((m) => m.id !== replaceId);
      return [...base, ...(replaceId ? [] : [user]), reply];
    });
    const patch = (fn: (m: Msg) => Msg) => setMsgs((cur) => (cur ?? []).map((m) => (m.id === reply.id ? fn(m) : m)));
    abort.current = new AbortController();
    let full = "";
    try {
      await chat({ text: p.text, model: model.id, voice: p.voice, attachments: p.attachments }, (e: StreamEvent) => {
        if (e.t === "meta") patch((m) => ({ ...m, model: e.model, note: e.note }));
        else if (e.t === "d") {
          full += e.v;
          patch((m) => ({ ...m, content: m.content + e.v }));
        } else if (e.t === "error") patch((m) => ({ ...m, streaming: false, error: e.message }));
        else if (e.t === "done") {
          patch((m) => ({ ...m, streaming: false }));
          if (full && (p.voice || speakOn)) voice.speak(reply.id, speakable(full));
        }
      }, abort.current.signal);
      patch((m) => (m.streaming ? { ...m, streaming: false, content: m.content || "", error: m.content ? undefined : "Stopped." } : m));
    } catch (err) {
      patch((m) => ({ ...m, streaming: false, error: (err as Error).message }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function submit() {
    const t = text.trim();
    if ((!t && !files.length) || busy) return;
    run({ text: t, attachments: files });
    setText("");
    setFiles([]);
  }

  async function addFiles(list: FileList | null, hint?: "audio") {
    if (!list?.length) return;
    try {
      const next = [...files];
      for (const f of Array.from(list).slice(0, ATLAS_LIMITS.files - files.length)) next.push(await prepareFile(f, f.name, hint));
      if (tooBig(next)) throw new ApiError("INVALID", "Those files are too big together (3 MB max). Try a smaller image or shorter clip.", 400);
      setFiles(next);
    } catch (err) {
      toastError(err);
    }
  }

  async function toggleMic() {
    if (rec.recording) {
      const blob = await rec.stop();
      if (blob) sendVoice(blob);
      return;
    }
    try {
      voice.stop();
      rec.onAutoStop.current = (blob) => blob && sendVoice(blob);
      await rec.start();
    } catch (err) {
      toastError(err);
    }
  }

  async function sendVoice(blob: Blob) {
    try {
      const clip = { ...(await prepareFile(blob, "Voice message")), voice: true };
      run({ text: text.trim(), voice: true, attachments: [...files, clip] });
      setText("");
      setFiles([]);
    } catch (err) {
      toastError(err);
    }
  }

  async function pick(id: string) {
    if (!data) return;
    setPicking(false);
    mutate({ ...data, model: id }, { revalidate: false });
    await savePrefs({ model: id }).catch(toastError);
  }

  async function toggleSpeak() {
    if (!data) return;
    if (voice.speaking) voice.stop();
    mutate({ ...data, speak: !speakOn }, { revalidate: false });
    await savePrefs({ speak: !speakOn }).catch(toastError);
  }

  async function clear() {
    if (!confirm("Clear your whole conversation with Atlas? This can't be undone.")) return;
    voice.stop();
    abort.current?.abort();
    await clearAtlas().then(() => setMsgs([])).catch(toastError);
  }

  if (error) {
    return <div className="p-6 text-center text-sm text-muted">Atlas couldn&apos;t load: {(error as Error).message}</div>;
  }
  if (!data || msgs === null) return <ChaosLoader label="Waking Atlas…" />;

  const offline = !data.ready.gemini && !data.ready.openrouter;
  // What "ask again" resends: the original turn (files included) when we have
  // it, or the earlier text question from saved history.
  const retryFor = (i: number): Payload | null => {
    const m = msgs[i];
    if (m.retry) return m.retry;
    const prev = msgs[i - 1];
    return prev?.role === "user" && !prev.attachments?.length && !prev.files?.length ? { text: prev.content, attachments: [] } : null;
  };
  const empty = msgs.length === 0;

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-140px)] max-w-2xl flex-col">
      <header className="sticky top-[54px] z-20 flex items-center gap-2 border-b border-line/60 bg-bg/95 px-3 py-2 backdrop-blur lg:top-0">
        <AtlasOrb state={orb} level={rec.level} size={36} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-black leading-tight tracking-wide">ATLAS</h1>
          <p className="truncate text-[11px] text-muted">by Jesse · YORU co-founder</p>
        </div>
        <button type="button" onClick={() => setPicking(true)}
          className="flex max-w-[45%] items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-card-2" aria-label="Choose model">
          <span className="truncate">{model?.name ?? "Pick a model"}</span>
          <ChevronDown size={14} className="shrink-0" />
        </button>
        {voice.supported && (
          <button type="button" onClick={toggleSpeak} aria-pressed={speakOn} title={speakOn ? "Replies are read aloud" : "Replies are silent"}
            aria-label={speakOn ? "Mute spoken replies" : "Read replies aloud"} className="rounded-full p-2 hover:bg-card-2">
            {speakOn ? <Volume2 size={19} /> : <VolumeX size={19} className="text-muted" />}
          </button>
        )}
        {!empty && (
          <button type="button" onClick={clear} aria-label="Clear conversation" className="rounded-full p-2 text-muted hover:bg-card-2 hover:text-ink">
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {!model && data.models.length > 0 && (
        <button type="button" onClick={() => setPicking(true)} className="mx-3 mt-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-start text-sm">
          The model you picked isn&apos;t available any more. <b>Choose another</b> to keep chatting.
        </button>
      )}
      {offline && (
        <div className="mx-3 mt-3 rounded-xl border border-line bg-card p-3 text-sm text-muted">Atlas isn&apos;t switched on yet. An admin needs to add its keys on the server.</div>
      )}

      <div className="flex-1 px-3 pb-4">
        {empty ? (
          <div className="flex flex-col items-center pt-8 text-center">
            <AtlasOrb state={orb} level={rec.level} size={176} />
            <h2 className="mt-6 text-2xl font-black">Hey {me.display_name}.</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">I&apos;m Atlas. Talk to me, show me a picture, or ask me to draft a post. Tap the mic to speak.</p>
            <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" disabled={busy || offline} onClick={() => run({ text: s, attachments: [] })}
                  className="rounded-full border border-line bg-card px-3.5 py-2 text-[13px] hover:border-brand disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4 pt-4" aria-live="polite">
            {msgs.map((m, i) => (
              <li key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] space-y-1.5">
                    {m.files?.some((f) => f.preview) && (
                      <div className="flex justify-end gap-1.5">
                        {m.files.filter((f) => f.preview).map((f, j) => <img key={j} src={f.preview} alt="" className="h-28 rounded-xl object-cover" />)}
                      </div>
                    )}
                    <div className="rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-[15px] text-white">
                      {m.files?.some((f) => f.kind === "voice") && <span className="me-1 inline-flex items-center gap-1 opacity-90"><AudioLines size={14} /></span>}
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-[92%]">
                    <div className="text-[15px] leading-relaxed">
                      {m.streaming && !m.content ? (
                        <span className="inline-flex items-center gap-2 text-sm text-muted"><AtlasOrb state="thinking" size={22} /> Thinking…</span>
                      ) : (
                        <Reply text={m.content} streaming={m.streaming} />
                      )}
                    </div>
                    {m.error && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-sm">
                        <span className="flex-1">{m.error}</span>
                        {retryFor(i) && (
                          <button type="button" disabled={busy} onClick={() => run(retryFor(i)!, m.id)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-bold">
                            <RotateCcw size={12} /> Retry
                          </button>
                        )}
                        {m.error && <button type="button" onClick={() => setPicking(true)} className="text-xs font-bold text-brand">Change model</button>}
                      </div>
                    )}
                    {!m.streaming && m.content && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
                        <button type="button" onClick={async () => { await navigator.clipboard.writeText(m.content).catch(() => null); setCopied(m.id); setTimeout(() => setCopied(null), 1500); }}
                          className="rounded-full p-1.5 hover:bg-card-2 hover:text-ink" aria-label="Copy reply">{copied === m.id ? <Check size={14} /> : <Copy size={14} />}</button>
                        {voice.supported && (
                          <button type="button" onClick={() => (voice.speaking === m.id ? voice.stop() : voice.speak(m.id, speakable(m.content)))}
                            className="rounded-full p-1.5 hover:bg-card-2 hover:text-ink" aria-label={voice.speaking === m.id ? "Stop speaking" : "Read aloud"}>
                            {voice.speaking === m.id ? <Square size={14} /> : <Volume2 size={14} />}
                          </button>
                        )}
                        {i === msgs.length - 1 && !busy && retryFor(i) && (
                          <button type="button" onClick={() => run(retryFor(i)!, m.id)} className="rounded-full p-1.5 hover:bg-card-2 hover:text-ink" aria-label="Ask again">
                            <RotateCcw size={14} />
                          </button>
                        )}
                        {m.model && <span className="ms-1 truncate">{m.model}</span>}
                        {m.note && <span className="w-full ps-1.5 text-amber-300/90">{m.note}</span>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-bg via-bg to-transparent px-3 pb-2 pt-4 lg:bottom-0 lg:pb-4">
        <div className="rounded-3xl border border-line bg-card/95 p-2 shadow-xl backdrop-blur">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pb-2">
              {files.map((f, i) => (
                <span key={i} className="relative flex items-center gap-1.5 rounded-xl border border-line bg-card-2 p-1 pe-6 text-xs">
                  {f.preview ? <img src={f.preview} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <AudioLines size={16} className="mx-1.5" />}
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          {rec.recording ? (
            <div className="flex items-center gap-3 px-2 py-1">
              <AtlasOrb state="listening" level={rec.level} size={40} />
              <span className="flex-1 text-sm font-bold">Listening… <span className="font-mono text-muted">{rec.seconds}s / {ATLAS_LIMITS.voiceSeconds}s</span></span>
              <button type="button" onClick={rec.cancel} className="rounded-full border border-line px-3 py-2 text-xs font-bold">Cancel</button>
              <button type="button" onClick={toggleMic} className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white">Send</button>
            </div>
          ) : (
            <div className="flex items-end gap-1">
              <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { addFiles(e.target.files, "audio"); e.target.value = ""; }} />
              <button type="button" onClick={() => imageInput.current?.click()} disabled={busy || files.length >= ATLAS_LIMITS.files} aria-label="Add a photo" className="rounded-full p-2.5 text-muted hover:bg-card-2 hover:text-ink disabled:opacity-40"><ImagePlus size={20} /></button>
              <button type="button" onClick={() => audioInput.current?.click()} disabled={busy || files.length >= ATLAS_LIMITS.files} aria-label="Add an audio file" className="rounded-full p-2.5 text-muted hover:bg-card-2 hover:text-ink disabled:opacity-40"><AudioLines size={20} /></button>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, ATLAS_LIMITS.text))} rows={1} placeholder="Ask Atlas anything…" aria-label="Message Atlas"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
                className="max-h-40 min-h-[42px] flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] outline-none [field-sizing:content]" />
              {busy ? (
                <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="rounded-full bg-card-2 p-2.5"><Square size={18} /></button>
              ) : text.trim() || files.length ? (
                <button type="button" onClick={submit} aria-label="Send" className="rounded-full bg-brand p-2.5 text-white"><Send size={18} /></button>
              ) : (
                <button type="button" onClick={toggleMic} disabled={!data.ready.gemini} aria-label="Talk to Atlas" className="rounded-full bg-brand p-2.5 text-white disabled:opacity-40"><Mic size={18} /></button>
              )}
            </div>
          )}
        </div>
        <p className="mt-1.5 px-2 text-center text-[10.5px] leading-snug text-muted">
          {empty
            ? "Atlas uses Google Gemini and free OpenRouter models. On free tiers they may use what you send to improve their AI, so don't share private info. "
            : "Free AI tiers may use what you send. Don't share private info. "}
          <Link href="/privacy#atlas" className="underline">Privacy</Link>
        </p>
      </div>

      <ModelPicker open={picking} onClose={() => setPicking(false)} models={data.models} value={data.model} onPick={pick} />
    </div>
  );
}
