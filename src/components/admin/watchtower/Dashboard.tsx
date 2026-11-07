"use client";

import { AlertTriangle, Bot, CircleCheck, FlaskConical, Fingerprint, Gavel, ShieldBan, UserRound } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { ChaosLoader, Empty } from "@/components/ui/bits";
import { BarList, TimeChart } from "@/components/pro/charts/Charts";
import { NW_LABEL } from "@/lib/nightwatch";

export type NwDashboard = {
  config: { enabled: boolean; test_mode: boolean; ai_text: boolean; ai_images: boolean };
  ai: { available: boolean; model: string | null };
  open: number;
  open_severe: number;
  open_reports: number;
  open_appeals: number;
  week: { total: number; automatic: number; human: number; blocked: number; removed: number; held: number; labeled: number; overturned: number; appeals_granted: number; appeals_denied: number };
  active_strikes: number;
  muted_now: number;
  median_review_minutes: number | null;
  daily: { day: string; automatic: number; human: number; waiting: number }[];
  categories: { category: string; label: string; n: number }[];
  ban_recommended: { id: string; username: string; display_name: string; avatar_url: string | null; strikes: number; severe: boolean }[];
  media_fingerprints: number;
};

function Kpi({ label, value, hint, tone, onClick }: { label: string; value: number | string; hint?: string; tone?: "warn" | "ok"; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C
      onClick={onClick}
      className={clsx("rounded-2xl border border-line p-4 text-start", onClick && "transition-colors hover:bg-card-2", tone === "warn" && "border-amber-500/40")}
    >
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className={clsx("mt-1 text-[26px] font-semibold tabular-nums leading-none", tone === "warn" && "text-amber-500")}>{value}</div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted">{hint}</div>}
    </C>
  );
}

// The Night Watch overview: what's waiting, what ran on its own, and whether
// the automation is healthy. Every number is counted from real events.
export function NwDashboardPanel({ onGoto, onMember }: { onGoto: (t: "queue" | "appeals" | "rules") => void; onMember: (id: string) => void }) {
  const { data, error } = useRpc<NwDashboard>("nw_dashboard", {}, { refreshInterval: 30_000 });
  if (error) return <Empty text={error.message} />;
  if (!data) return <ChaosLoader />;
  const w = data.week;
  const autoShare = w.automatic + w.human > 0 ? Math.round((w.automatic / (w.automatic + w.human)) * 100) : null;
  const labels = data.daily.map((d) => new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line px-4 py-3 text-[13.5px]">
        <span className={clsx("flex items-center gap-1.5 font-semibold", data.config.enabled ? "text-online" : "text-brand")}>
          <span className={clsx("h-2 w-2 rounded-full", data.config.enabled ? "bg-online" : "bg-brand")} />
          Night Watch {data.config.enabled ? "is on" : "is off"}
        </span>
        <span className="text-muted">·</span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <Bot size={15} />
          {data.ai.available ? `AI review on (${data.ai.model})` : "Rules only: add ANTHROPIC_API_KEY on the server to turn on AI review"}
        </span>
        {data.config.test_mode && (
          <span className="ms-auto flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[12px] font-semibold text-amber-500">
            <FlaskConical size={13} /> Test mode: AI decisions are logged, not enforced
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Waiting for a person" value={data.open} hint={data.open_severe ? `${data.open_severe} urgent` : "Nothing urgent"} tone={data.open_severe ? "warn" : undefined} onClick={() => onGoto("queue")} />
        <Kpi label="Handled automatically (7 days)" value={w.automatic} hint={autoShare === null ? "No decisions yet" : `${autoShare}% of all decisions`} />
        <Kpi label="Appeals waiting" value={data.open_appeals} hint={`${w.appeals_granted} granted, ${w.appeals_denied} denied this week`} onClick={() => onGoto("appeals")} />
        <Kpi label="Median time to review" value={data.median_review_minutes === null ? "–" : `${data.median_review_minutes}m`} hint="Last 30 days" />
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line p-4">
          <h3 className="mb-2 text-[14px] font-semibold">Decisions per day</h3>
          <TimeChart
            title="Night Watch decisions per day, automatic versus reviewed by a person"
            labels={labels}
            series={[
              { key: "auto", label: "Automatic", color: "var(--viz-1)", values: data.daily.map((d) => d.automatic) },
              { key: "human", label: "Reviewed by a person", color: "var(--viz-2)", values: data.daily.map((d) => d.human) },
            ]}
          />
        </section>
        <section className="rounded-2xl border border-line p-4">
          <h3 className="mb-3 text-[14px] font-semibold">By rule (30 days)</h3>
          {data.categories.length ? (
            <BarList rows={data.categories.slice(0, 8).map((c) => ({ label: NW_LABEL[c.category] ?? c.label, value: c.n }))} />
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <CircleCheck size={16} className="text-online" /> No rule breaks recorded.
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Blocked before posting" value={w.blocked} />
        <Kpi label="Removed after posting" value={w.removed} />
        <Kpi label="Held for review" value={w.held} />
        <Kpi label="Reversed" value={w.overturned} />
        <Kpi label="Muted right now" value={data.muted_now} hint={`${data.active_strikes} active strikes`} />
      </div>

      <section className="rounded-2xl border border-line p-4">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <ShieldBan size={16} /> Ban recommended
        </h3>
        <p className="mt-0.5 text-[12.5px] text-muted">Four active strikes or a child-safety strike. Night Watch never bans by itself: open the file and decide.</p>
        {data.ban_recommended.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Nobody right now.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/70">
            {data.ban_recommended.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onMember(p.id)} className="flex w-full items-center gap-3 py-2.5 text-start hover:bg-card-2">
                  <Avatar src={p.avatar_url} name={p.display_name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{p.display_name}</span>
                    <span className="block text-[12px] text-muted">@{p.username}</span>
                  </span>
                  {p.severe && (
                    <span className="flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-brand">
                      <AlertTriangle size={12} /> Child safety
                    </span>
                  )}
                  <span className="text-[12.5px] tabular-nums text-ink-2">{p.strikes} strikes</span>
                  <UserRound size={16} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-4 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Fingerprint size={14} /> {data.media_fingerprints} removed files fingerprinted
        </span>
        <span className="flex items-center gap-1.5">
          <Gavel size={14} /> {data.open_reports} open member reports
        </span>
        <button type="button" onClick={() => onGoto("rules")} className="underline-offset-2 hover:underline">
          Tune the rules
        </button>
      </div>
    </div>
  );
}
