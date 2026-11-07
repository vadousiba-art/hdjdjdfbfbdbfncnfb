"use client";

import Link from "next/link";
import { AlertTriangle, Bot, Flag, Fingerprint, ScrollText } from "lucide-react";
import clsx from "clsx";
import { mediaSrc } from "@/lib/client/api";
import { Avatar } from "@/components/ui/Avatar";
import { TimeAgo } from "@/components/ui/bits";
import { NW_LABEL, VERDICT_LABEL, type NwEvent } from "@/lib/nightwatch";

const SOURCE: Record<string, { label: string; icon: typeof Bot }> = {
  rules: { label: "Rules", icon: ScrollText },
  ai: { label: "AI", icon: Bot },
  reports: { label: "Reports", icon: Flag },
  media: { label: "Fingerprint", icon: Fingerprint },
  staff: { label: "Staff", icon: ScrollText },
};

export const accountAge = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days < 1 ? "new today" : days < 30 ? `${days}d old` : days < 365 ? `${Math.floor(days / 30)}mo old` : `${Math.floor(days / 365)}y old`;
};

export function VerdictChip({ e }: { e: NwEvent }) {
  const tone =
    e.status === "overturned" ? "bg-online/15 text-online" : e.severe ? "bg-brand text-white" : ["remove", "block"].includes(e.verdict) ? "bg-brand/15 text-brand" : e.verdict === "hold" ? "bg-amber-500/15 text-amber-500" : "bg-card-2 text-ink-2";
  return (
    <span className={clsx("rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide", tone)}>
      {e.status === "overturned" ? "Reversed" : VERDICT_LABEL[e.verdict] ?? e.verdict}
    </span>
  );
}

// One moderation case: what was posted, what Night Watch decided and why,
// who posted it, and what members reported.
export function CaseCard({ e, compact, onMember }: { e: NwEvent; compact?: boolean; onMember?: (id: string) => void }) {
  const src = SOURCE[e.source] ?? SOURCE.rules;
  const link = e.target_id && e.target_type === "post" ? `/post/${e.target_id}` : e.target_type === "user" && e.author ? `/u/${e.author.username}` : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {e.severe && <AlertTriangle size={14} className="text-brand" />}
        <VerdictChip e={e} />
        <span className="font-semibold text-ink">{NW_LABEL[e.category] ?? e.label}</span>
        <span className="flex items-center gap-1 text-muted">
          · <src.icon size={12} /> {src.label}
          {e.confidence !== null && e.source !== "rules" && ` ${Math.round(e.confidence * 100)}%`}
        </span>
        <span className="text-muted">· {e.target_type === "user" ? "profile" : e.target_type}</span>
        {e.report_count > 0 && <span className="text-muted">· {e.report_count} report{e.report_count === 1 ? "" : "s"}</span>}
        {e.test_mode && <span className="rounded bg-amber-500/15 px-1 text-[10.5px] font-bold text-amber-500">TEST</span>}
        <TimeAgo iso={e.created_at} className="ms-auto text-muted" />
      </div>
      {e.excerpt && (
        <p className={clsx("mt-2 whitespace-pre-wrap break-words rounded-xl bg-card-2 px-3 py-2 text-[14px] text-ink", compact && "line-clamp-2")}>{e.excerpt}</p>
      )}
      {!compact && e.media_url && (
        <div className="mt-2 overflow-hidden rounded-xl border border-line bg-black">
          {e.media_type === "video" ? (
            <video src={mediaSrc(e.media_url)} controls playsInline preload="metadata" className="max-h-80 w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc(e.media_url)} alt="Reported media" className="max-h-80 w-full object-contain" />
          )}
        </div>
      )}
      {e.reason && <p className={clsx("mt-2 text-[13px] text-ink-2", compact && "line-clamp-1")}>{e.reason}</p>}
      {!compact && e.reports && e.reports.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px] text-ink-2">
          {e.reports.slice(0, 5).map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <Flag size={12} className="mt-0.5 shrink-0 text-muted" />
              <span>
                <b className="font-medium">{NW_LABEL[r.category] ?? r.category}</b>: {r.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!compact && e.appeal && (
        <p className="mt-2 rounded-xl border border-line px-3 py-2 text-[13px]">
          <b className="font-semibold">Appeal ({e.appeal.status}):</b> {e.appeal.body}
        </p>
      )}
      {e.author && (
        <div className="mt-2.5 flex items-center gap-2 text-[12.5px]">
          <Avatar src={e.author.avatar_url} name={e.author.display_name} size={22} />
          <button type="button" onClick={() => e.author && onMember?.(e.author.id)} className="font-medium hover:underline">
            {e.author.display_name}
          </button>
          <span className="text-muted">
            @{e.author.username} · {accountAge(e.author.created_at)} · {e.author.strikes} active strike{e.author.strikes === 1 ? "" : "s"}
            {e.author.muted_until && new Date(e.author.muted_until) > new Date() && " · muted"}
            {e.author.banned && " · banned"}
          </span>
          {link && !compact && (
            <Link href={link} className="ms-auto text-muted underline-offset-2 hover:underline">
              Open
            </Link>
          )}
        </div>
      )}
      {!compact && e.reviewer && (
        <p className="mt-2 text-[12px] text-muted">
          Reviewed by {e.reviewer.display_name}
          {e.note && `: ${e.note}`}
        </p>
      )}
    </div>
  );
}
