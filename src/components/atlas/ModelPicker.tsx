"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Eye, Mic, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { AtlasModel } from "@/lib/atlas/models";

const ctx = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : `${Math.round(n / 1000)}K`);

export function Caps({ m }: { m: AtlasModel }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="rounded-full bg-online/15 px-1.5 py-px text-[10px] font-bold text-online">FREE</span>
      {m.audio && m.provider === "gemini" && <span className="inline-flex items-center gap-0.5 rounded-full bg-card-2 px-1.5 py-px text-[10px] font-bold text-ink-2"><Mic size={10} /> Voice</span>}
      {m.vision && <span className="inline-flex items-center gap-0.5 rounded-full bg-card-2 px-1.5 py-px text-[10px] font-bold text-ink-2"><Eye size={10} /> Images</span>}
      <span className="rounded-full bg-card-2 px-1.5 py-px text-[10px] font-bold text-muted">{ctx(m.context)} context</span>
    </span>
  );
}

// Only free models are listed (the server offers nothing else). Gemini stays
// the engine for voice and audio whatever is picked here.
export function ModelPicker({ open, onClose, models, value, onPick }: { open: boolean; onClose: () => void; models: AtlasModel[]; value: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? models.filter((m) => `${m.name} ${m.id} ${m.blurb ?? ""}`.toLowerCase().includes(n)) : models;
  }, [models, q]);
  const gemini = list.filter((m) => m.provider === "gemini");
  const text = list.filter((m) => m.provider === "openrouter");

  const row = (m: AtlasModel) => (
    <button key={m.id} type="button" onClick={() => onPick(m.id)} aria-pressed={value === m.id}
      className={clsx("flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors",
        value === m.id ? "border-brand bg-brand/10" : "border-line hover:bg-card-2")}>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{m.name}</span>
        {m.blurb && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{m.blurb}</span>}
        <span className="mt-1.5 block"><Caps m={m} /></span>
      </span>
      {value === m.id && <Check size={18} className="mt-1 shrink-0 text-brand" />}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Choose Atlas's model">
      <div className="space-y-3">
        {models.length > 6 && (
          <label className="flex items-center gap-2 rounded-xl border border-line bg-card-2 px-3 py-2">
            <Search size={16} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models" className="w-full bg-transparent text-sm outline-none" />
          </label>
        )}
        {gemini.length > 0 && <div className="space-y-2">{gemini.map(row)}</div>}
        {text.length > 0 && (
          <div className="space-y-2">
            <div className="pt-1 text-[11px] font-bold uppercase tracking-wider text-muted">Free text models · OpenRouter</div>
            {text.map(row)}
          </div>
        )}
        {!list.length && <p className="py-6 text-center text-sm text-muted">No models match.</p>}
        <p className="text-xs leading-relaxed text-muted">
          Only free models are offered. Which models are free, and their limits, change often; a busy model says so and you can pick another.
          Voice and audio always go to Gemini. Images go to your model if it can see them, otherwise to Gemini (Atlas tells you when).
        </p>
      </div>
    </Modal>
  );
}
