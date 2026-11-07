"use client";

import { useEffect, useState } from "react";
import { Check, Inbox, RotateCcw, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import type { NwEvent } from "@/lib/nightwatch";
import { CaseCard } from "./CaseCard";

type View = "open" | "held" | "reports" | "auto" | "reviewed";
const VIEWS: [View, string][] = [
  ["open", "Needs review"],
  ["held", "Held"],
  ["reports", "Reports"],
  ["auto", "Automatic"],
  ["reviewed", "Reviewed"],
];

// The review queue. Urgent cases first. Keyboard: J/K to move, R remove with
// a strike, Shift+R remove without, A restore, D dismiss.
export function NwQueue({ onMember }: { onMember: (id: string) => void }) {
  const { toast, toastError } = useApp();
  const [view, setView] = useState<View>("open");
  const { data, error, mutate } = useRpc<NwEvent[]>("nw_queue", { p_view: view, p_limit: 100 }, { refreshInterval: 20_000 });
  const [sel, setSel] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const list = data ?? [];
  const cur = list[Math.min(sel, Math.max(0, list.length - 1))];
  const decidable = cur && (cur.status === "open" || cur.status === "auto" || cur.status === "dismissed");

  async function decide(decision: "remove" | "restore" | "dismiss", strike = true) {
    if (!cur || busy) return;
    setBusy(true);
    try {
      await rpc("nw_review", { p_event_id: cur.id, p_decision: decision, p_strike: strike, p_note: note });
      toast(decision === "remove" ? (strike ? "Removed with a strike." : "Removed.") : decision === "restore" ? "Restored and the member was told." : "Dismissed.", "success");
      setNote("");
      await mutate();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[role=dialog]")) return;
      if (e.key === "j") setSel((s) => Math.min(s + 1, list.length - 1));
      else if (e.key === "k") setSel((s) => Math.max(s - 1, 0));
      else if (!decidable) return;
      else if (e.key === "r") decide("remove", true);
      else if (e.key === "R") decide("remove", false);
      else if (e.key === "a") decide("restore");
      else if (e.key === "d") decide("dismiss");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line/70" role="tablist">
        {VIEWS.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={view === k}
            onClick={() => {
              setView(k);
              setSel(0);
            }}
            className={clsx("relative shrink-0 px-3 py-2.5 text-[13.5px]", view === k ? "font-semibold text-ink" : "text-muted hover:text-ink-2")}
          >
            {label}
            {view === k && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-ink" />}
          </button>
        ))}
      </div>

      {error && <Empty text={error.message} />}
      {!data && !error && <ChaosLoader />}
      {data && list.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Inbox size={30} strokeWidth={1.5} className="text-muted" />
          <p className="font-semibold">All clear</p>
          <p className="text-[13px] text-muted">{view === "open" ? "Nothing needs a person right now." : "Nothing here."}</p>
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ul className="max-h-[70vh] divide-y divide-line/70 overflow-y-auto rounded-2xl border border-line" aria-label="Cases">
            {list.map((e, i) => (
              <li key={e.id}>
                <button type="button" onClick={() => setSel(i)} className={clsx("block w-full px-3 py-3 text-start", e === cur ? "bg-card-2" : "hover:bg-card-2/60")} aria-current={e === cur}>
                  <CaseCard e={e} compact />
                </button>
              </li>
            ))}
          </ul>
          {cur && (
            <section className="h-fit rounded-2xl border border-line p-4 lg:sticky lg:top-4" aria-label="Case">
              <CaseCard e={cur} onMember={onMember} />
              {decidable ? (
                <>
                  <input
                    value={note}
                    onChange={(ev) => setNote(ev.target.value.slice(0, 500))}
                    placeholder="Note for the log (optional)"
                    className="mt-4 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-[13.5px] outline-none focus:border-ink/40"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="danger" disabled={busy} onClick={() => decide("remove", true)}>
                      <Trash2 size={15} /> Remove + strike <kbd className="ms-1 text-[10px] opacity-70">R</kbd>
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => decide("remove", false)}>
                      Remove only
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => decide("restore")}>
                      <RotateCcw size={15} /> Restore <kbd className="ms-1 text-[10px] opacity-70">A</kbd>
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => decide("dismiss")}>
                      <X size={15} /> Dismiss <kbd className="ms-1 text-[10px] opacity-70">D</kbd>
                    </Button>
                  </div>
                  {cur.severe && (
                    <p className="mt-3 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-[12.5px] text-ink-2">
                      Child-safety case. Keep the evidence (removed content is kept hidden, not erased) and report it to Cybertip.ca (Canada) or NCMEC
                      (US). Night Watch can&apos;t file that report for you.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-[13px] text-muted">
                  <Check size={15} /> Decided. Open the member file to change strikes.
                </p>
              )}
            </section>
          )}
        </div>
      )}
      <p className="mt-3 hidden text-[12px] text-muted lg:block">Keys: J/K move · R remove with strike · Shift+R remove only · A restore · D dismiss</p>
    </div>
  );
}
