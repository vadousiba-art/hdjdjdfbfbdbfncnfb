"use client";

import { useState } from "react";
import { Bot, Gavel } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Button, ChaosLoader, Empty, TimeAgo } from "@/components/ui/bits";
import type { NwEvent } from "@/lib/nightwatch";
import { CaseCard } from "./CaseCard";

type Appeal = { id: string; created_at: string; body: string; status: string; priority: number; auto_note: string; note: string; decided_at: string | null; event: NwEvent };

// Appeals, highest priority first. The AI's second opinion (when it ran) is
// shown, but a person makes the call on anything it wasn't sure about.
export function NwAppeals({ onMember }: { onMember: (id: string) => void }) {
  const { toast, toastError } = useApp();
  const [status, setStatus] = useState<"open" | "all">("open");
  const { data, error, mutate } = useRpc<Appeal[]>("nw_appeals", { p_status: status });
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function decide(a: Appeal, grant: boolean) {
    try {
      await rpc("nw_decide_appeal", { p_appeal_id: a.id, p_grant: grant, p_note: notes[a.id] ?? "" });
      toast(grant ? "Granted. Restored and the strike is gone." : "Denied. The member was told.", "success");
      mutate();
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {(["open", "all"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={clsx("rounded-full px-3 py-1.5 text-[13px]", status === s ? "bg-ink font-semibold text-bg" : "bg-card-2 text-ink-2")}>
            {s === "open" ? "Waiting" : "Last 60 days"}
          </button>
        ))}
      </div>
      {error && <Empty text={error.message} />}
      {!data && !error && <ChaosLoader />}
      {data && data.length === 0 && <Empty text="No appeals waiting." />}
      <ul className="mt-3 space-y-3">
        {data?.map((a) => (
          <li key={a.id} className="rounded-2xl border border-line p-4">
            <div className="flex items-center gap-2 text-[13px]">
              <Gavel size={15} />
              <b className="font-semibold">Appeal</b>
              <span className={clsx("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase", a.status === "open" ? "bg-amber-500/15 text-amber-500" : a.status === "granted" ? "bg-online/15 text-online" : "bg-card-2 text-ink-2")}>
                {a.status}
              </span>
              <TimeAgo iso={a.created_at} className="ms-auto text-muted" />
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-line px-3 py-2 text-[14px]">{a.body}</p>
            {a.auto_note && (
              <p className="mt-2 flex gap-1.5 text-[12.5px] text-ink-2">
                <Bot size={14} className="mt-0.5 shrink-0" /> {a.auto_note}
              </p>
            )}
            <div className="mt-3 border-t border-line/70 pt-3">
              <CaseCard e={a.event} onMember={onMember} />
            </div>
            {a.status === "open" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value.slice(0, 500) }))}
                  placeholder="Message to the member (optional)"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2 text-[13.5px] outline-none focus:border-ink/40"
                />
                <Button onClick={() => decide(a, true)}>Grant</Button>
                <Button variant="outline" onClick={() => decide(a, false)}>
                  Deny
                </Button>
              </div>
            ) : (
              a.note && <p className="mt-2 text-[12.5px] text-muted">Note: {a.note}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
