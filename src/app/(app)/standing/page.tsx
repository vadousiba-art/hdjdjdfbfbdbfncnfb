"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, CircleCheck, Clock, Gavel, ShieldCheck, ShieldHalf } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Button, ChaosLoader, Empty, TimeAgo } from "@/components/ui/bits";
import { Modal } from "@/components/ui/Modal";
import { NW_LABEL, VERDICT_LABEL } from "@/lib/nightwatch";

type Standing = {
  status: "good" | "warned" | "limited" | "muted";
  muted_until: string | null;
  active_strikes: number;
  strike_days: number;
  ladder: number[];
  strikes: { id: string; category: string; label: string; created_at: string; expires_at: string; active: boolean; revoked: boolean }[];
  decisions: {
    id: string;
    created_at: string;
    target_type: string;
    verdict: string;
    category: string;
    label: string;
    excerpt: string;
    status: string;
    appealable: boolean;
    appeal: { status: "open" | "granted" | "denied"; note: string; created_at: string } | null;
  }[];
};

const LEVELS = [
  { name: "All good", hint: "No active strikes." },
  { name: "Warned", hint: "One active strike. Nothing is limited." },
  { name: "Limited", hint: "Recent strikes come with short mutes." },
  { name: "Very limited", hint: "Another strike means a week-long mute." },
  { name: "At risk", hint: "An admin may review your account for a ban." },
];

const fmtMins = (m: number) => (m >= 1440 ? `${Math.round(m / 1440)} day${m >= 2880 ? "s" : ""}` : m >= 60 ? `${Math.round(m / 60)} hours` : `${m} minutes`);

// Account Standing: what Night Watch has decided about you, why, and how to
// appeal. No secrets: every strike and decision about your content is here.
export default function StandingPage() {
  const { data, error, mutate } = useRpc<Standing>("get_my_standing");
  const [appealing, setAppealing] = useState<Standing["decisions"][number] | null>(null);
  if (error) return <Empty text={error.message} />;
  if (!data) return <ChaosLoader />;
  const level = Math.min(data.active_strikes, 4);

  return (
    <div className="pb-8">
      <h1 className="pt-3 text-[22px] font-bold tracking-tight">Account standing</h1>
      <p className="mt-1 text-[14px] text-muted">How your account is doing with YORU&apos;s community rules.</p>

      <section className="mt-5 rounded-2xl border border-line p-5">
        <div className="flex items-center gap-3">
          <span className={clsx("flex h-12 w-12 items-center justify-center rounded-full", level === 0 ? "bg-online/15 text-online" : level >= 3 ? "bg-brand/15 text-brand" : "bg-amber-500/15 text-amber-500")}>
            {level === 0 ? <ShieldCheck size={26} /> : <ShieldHalf size={26} />}
          </span>
          <div>
            <p className="text-[18px] font-semibold">{LEVELS[level].name}</p>
            <p className="text-[13.5px] text-muted">{LEVELS[level].hint}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-5 gap-1.5" aria-hidden>
          {LEVELS.map((l, i) => (
            <div key={l.name}>
              <div className={clsx("h-2 rounded-full", i <= level ? (level === 0 ? "bg-online" : level >= 3 ? "bg-brand" : "bg-amber-500") : "bg-card-2")} />
              <p className={clsx("mt-1.5 text-center text-[10.5px] leading-tight", i === level ? "font-semibold text-ink" : "text-muted")}>{l.name}</p>
            </div>
          ))}
        </div>
        {data.muted_until && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-card-2 px-3 py-2.5 text-[13.5px]">
            <Clock size={16} className="shrink-0 text-amber-500" />
            You can read and browse, but posting, commenting and messaging are paused until {new Date(data.muted_until).toLocaleString()}.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-[15px] font-semibold">How strikes work</h2>
        <ol className="mt-2 grid gap-2 text-[13.5px] text-ink-2 sm:grid-cols-2">
          {data.ladder.map((m, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card-2 text-[12px] font-bold">{i + 1}</span>
              {m === 0 ? "A warning, nothing else" : `Paused for ${fmtMins(m)}`}
              {i === data.ladder.length - 1 && " (and an admin review)"}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[12.5px] text-muted">
          Strikes expire after {data.strike_days} days. Bans are never automatic: a person decides. Read the full rules in the <Link href="/terms" className="underline">Terms</Link>.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-[15px] font-semibold">Decisions about your content</h2>
        {data.decisions.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-muted">
            <CircleCheck size={17} className="text-online" /> Nothing here. Keep being you.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line/70">
            {data.decisions.map((d) => (
              <li key={d.id} className="py-3.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <span className={clsx("rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", d.status === "overturned" ? "bg-online/15 text-online" : "bg-card-2 text-ink-2")}>
                    {d.status === "overturned" ? "Reversed" : VERDICT_LABEL[d.verdict] ?? d.verdict}
                  </span>
                  <span className="font-medium">{NW_LABEL[d.category] ?? d.label}</span>
                  <span className="text-muted">· your {d.target_type === "user" ? "profile" : d.target_type}</span>
                  <TimeAgo iso={d.created_at} className="ms-auto text-muted" />
                </div>
                {d.excerpt && <p className="mt-1.5 line-clamp-3 rounded-lg bg-card-2 px-3 py-2 text-[13.5px] text-ink-2">“{d.excerpt}”</p>}
                <div className="mt-2 flex items-center gap-3">
                  {d.appeal ? (
                    <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
                      <Gavel size={15} />
                      Appeal {d.appeal.status === "open" ? "in review" : d.appeal.status}
                      {d.appeal.note && <span className="text-muted">· {d.appeal.note}</span>}
                    </span>
                  ) : d.appealable ? (
                    <Button variant="outline" className="h-8 px-3 text-[13px]" onClick={() => setAppealing(d)}>
                      Appeal
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.strikes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold">Strikes this year</h2>
          <ul className="mt-2 divide-y divide-line/70">
            {data.strikes.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2.5 text-[13.5px]">
                <span className={clsx("h-2 w-2 rounded-full", s.active ? "bg-amber-500" : "bg-line")} />
                <span className="font-medium">{NW_LABEL[s.category] ?? s.label}</span>
                <span className="text-muted">
                  · {s.revoked ? "removed after review" : s.active ? `expires ${new Date(s.expires_at).toLocaleDateString()}` : "expired"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 flex items-center gap-1.5 text-[12.5px] text-muted">
        <BadgeCheck size={14} className="text-[#5865f2]" /> Notices come from the official YORU account in your inbox.
      </p>

      <AppealDialog decision={appealing} onClose={() => setAppealing(null)} onDone={() => mutate()} />
    </div>
  );
}

function AppealDialog({ decision, onClose, onDone }: { decision: Standing["decisions"][number] | null; onClose: () => void; onDone: () => void }) {
  const { toast, toastError } = useApp();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!decision) return;
    setBusy(true);
    try {
      const r = await rpc<{ status: string }>("submit_appeal", { p_event_id: decision.id, p_body: body });
      toast(r.status === "granted" ? "Appeal granted. It's back." : "Appeal sent. A second review is on the way.", "success");
      setBody("");
      onDone();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={decision !== null} onClose={onClose} title="Appeal this decision">
      <p className="text-[13.5px] text-muted">Tell us what we got wrong. Context helps: was it a joke between friends, a quote, or a mistake? Each decision can be appealed once.</p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 1000))}
        rows={5}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-card-2 px-3 py-2.5 text-[14.5px] outline-none focus:border-ink/40"
        placeholder="Why should this be reversed?"
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={busy || body.trim().length < 3}>
          Send appeal
        </Button>
      </div>
    </Modal>
  );
}
