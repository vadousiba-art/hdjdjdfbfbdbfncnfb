"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Loader2, Orbit, RotateCcw, X } from "lucide-react";
import { assist } from "@/lib/client/atlas";
import type { AssistTask } from "@/lib/atlas/prompt";

const LABEL: Record<AssistTask, string> = {
  post: "Write it for me",
  caption: "Write a caption",
  rewrite: "Polish what I wrote",
  bio: "Write my bio",
  comment: "Draft a reply",
  message: "Draft a message",
};

// Atlas inside YORU's own text boxes. It only suggests: "Use this" puts the
// text in the box, and the member still presses Post / Send / Save.
export function AtlasAssist({ value, onUse, tasks, context, className, align = "start" }: {
  value: string;
  onUse: (text: string) => void;
  tasks: AssistTask[];
  context?: string;
  className?: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<AssistTask | null>(null);
  const [out, setOut] = useState<{ task: AssistTask; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && !busy && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, busy]);

  async function go(task: AssistTask) {
    setBusy(task);
    setErr(null);
    try {
      const r = await assist(task, value, context);
      setOut({ task, text: r.text });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const usable = tasks.filter((t) => t !== "rewrite" || value.trim());
  return (
    <div ref={box} className={clsx("relative", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Ask Atlas to help write this" title="Atlas"
        className={clsx("rounded-full p-1.5 transition-colors hover:bg-card-2", open ? "text-brand" : "text-muted hover:text-ink")}>
        <Orbit size={19} />
      </button>
      {open && (
        <div className={clsx("absolute bottom-full z-50 mb-2 w-[min(320px,80vw)] rounded-2xl border border-line bg-card p-2 text-sm shadow-2xl", align === "end" ? "end-0" : "start-0")}>
          <div className="flex items-center justify-between px-1.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
            Atlas
            <button type="button" onClick={() => { setOpen(false); setOut(null); }} aria-label="Close"><X size={14} /></button>
          </div>
          {out ? (
            <div>
              <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl bg-card-2 p-2.5 text-[14px] leading-relaxed">{out.text}</p>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => { onUse(out.text); setOut(null); setOpen(false); }} className="flex-1 rounded-full bg-brand py-1.5 text-xs font-bold text-white">Use this</button>
                <button type="button" disabled={busy !== null} onClick={() => go(out.task)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold">
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Again
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {usable.map((t) => (
                <button key={t} type="button" disabled={busy !== null || (!value.trim() && !context)} onClick={() => go(t)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-start hover:bg-card-2 disabled:opacity-50">
                  {LABEL[t]}
                  {busy === t && <Loader2 size={14} className="animate-spin" />}
                </button>
              ))}
              {!value.trim() && !context && <p className="px-2.5 pb-1 text-xs text-muted">Type a few words about what you want, then pick one.</p>}
            </div>
          )}
          {err && <p className="mt-2 rounded-xl bg-brand/10 px-2.5 py-2 text-xs text-ink">{err}</p>}
        </div>
      )}
    </div>
  );
}
