"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ChaosLoader, Empty, TimeAgo } from "@/components/ui/bits";
import en from "@/lib/i18n/messages/en";
import type { CreatorCategory } from "@/lib/opengates";
import type { ProfileLite } from "@/lib/types";

// Admin tools for Open Gates. Every action is checked again by the database
// (require_admin) and written to the audit log; nothing here is client-only.

type QueueItem = {
  id: string;
  category: CreatorCategory;
  portfolio_url: string;
  statement: string;
  status: string;
  created_at: string;
  applicant: ProfileLite;
  previous: number;
};

export function AdminCreators() {
  const { toast, toastError } = useApp();
  const { data, mutate } = useRpc<QueueItem[]>("admin_creator_queue", { p_status: "pending" });
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(id: string, approve: boolean) {
    try {
      await rpc("admin_review_creator", { p_application_id: id, p_approve: approve, p_note: notes[id] ?? "" });
      toast(approve ? "Approved. They now have a creator label." : "Not approved. They were notified.", "success", approve ? "🎨" : "📨");
      mutate();
    } catch (err) {
      toastError(err);
    }
  }

  if (!data) return <ChaosLoader />;
  if (!data.length) return <Empty text="No creator applications waiting." />;
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-muted">
        Check that the link shows the applicant&apos;s own work and that they are not impersonating someone. Approval adds a community
        label; it is not a partnership.
      </p>
      {data.map((a) => (
        <div key={a.id} className="card p-3">
          <div className="flex items-center gap-2">
            <Avatar src={a.applicant.avatar_url} name={a.applicant.display_name} size={32} />
            <Link href={`/u/${a.applicant.username}`} className="font-bold hover:underline">
              {a.applicant.display_name}
            </Link>
            <span className="text-xs text-muted">
              @{a.applicant.username} · <TimeAgo iso={a.created_at} />
              {a.previous ? ` · ${a.previous} earlier application(s)` : ""}
            </span>
            <span className="ms-auto rounded-full bg-card-2 px-2 py-0.5 text-xs font-bold">{en[`creator.${a.category}`]}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm" dir="auto">
            {a.statement}
          </p>
          <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 break-all text-xs font-bold text-brand">
            {a.portfolio_url} <ExternalLink size={12} />
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={notes[a.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value.slice(0, 300) })}
              placeholder="Note to the applicant (optional)"
              className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <Button variant="outline" className="py-1.5 text-xs" onClick={() => review(a.id, false)}>
              Not now
            </Button>
            <Button className="py-1.5 text-xs" onClick={() => review(a.id, true)}>
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

type ProRow = { user: ProfileLite; source: string; ends_at: string | null; note: string; created_at: string };

export function AdminPro({ members }: { members: ProfileLite[] }) {
  const { toast, toastError } = useApp();
  const { data, mutate } = useRpc<ProRow[]>("admin_pro_members", {});
  const [who, setWho] = useState("");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const target = members.find((m) => m.username.toLowerCase() === who.trim().replace(/^@/, "").toLowerCase());

  return (
    <div className="space-y-3">
      <div className="card p-3 text-xs text-muted">
        Paid Pro runs through PayPal once PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID are set on the server (see docs/billing.md); until then nobody
        can buy it. Complimentary grants here are for testing and early supporters; each one is recorded in the audit log.
      </div>
      <form
        className="card flex flex-wrap items-end gap-2 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target) return;
          try {
            await rpc("admin_grant_pro", { p_user: target.id, p_days: days, p_note: note });
            toast(`Pro granted to @${target.username} for ${days} days.`, "success", "🌙");
            setWho("");
            setNote("");
            mutate();
          } catch (err) {
            toastError(err);
          }
        }}
      >
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-semibold">Member</span>
          <input list="pro-members" value={who} onChange={(e) => setWho(e.target.value)} placeholder="@username" className="w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand" />
          <datalist id="pro-members">
            {members.map((m) => (
              <option key={m.id} value={m.username} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold">Days</span>
          <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(Math.max(1, Math.min(366, Number(e.target.value) || 1)))} className="w-24 rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand" />
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="mb-1 block text-xs font-semibold">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Why (optional)" className="w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand" />
        </label>
        <Button type="submit" disabled={!target} className="py-2">
          Grant Pro
        </Button>
      </form>
      {!data ? (
        <ChaosLoader />
      ) : data.length === 0 ? (
        <Empty text="Nobody has Pro right now." />
      ) : (
        data.map((r) => (
          <div key={r.user.id + r.created_at} className="card flex items-center gap-3 p-3">
            <Avatar src={r.user.avatar_url} name={r.user.display_name} size={32} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-bold">{r.user.display_name}</div>
              <div className="text-xs text-muted">
                {r.source === "comp" ? "Complimentary" : r.source} · {r.ends_at ? `until ${new Date(r.ends_at).toLocaleDateString()}` : "no end date"}
                {r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            {r.source === "comp" && (
              <Button
                variant="outline"
                className="py-1.5 text-xs"
                onClick={async () => {
                  try {
                    await rpc("admin_revoke_pro", { p_user: r.user.id });
                    mutate();
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                Revoke
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
