"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Lock } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { useRpc } from "@/lib/client/hooks";
import { WIDGETS, dashboards, insightLayouts, item, milestones, type BoardP, type Widget } from "@/lib/pro/catalog";
import type { Item } from "@/lib/pro/types";
import { equip, ownsItem, saveProSettings, useMyPro, useProUniverse, type MyPro } from "@/lib/client/pro";
import { BarList, DayGrid, StatTile, TimeChart, compact } from "@/components/pro/charts/Charts";
import { MilestoneEmblem } from "@/components/pro/art/Marks";

// Creator Analytics (10) and Profile Insights (14). Every number comes from
// get_creator_analytics: your own posts, and other members' reactions,
// comments and saves on them. Your own activity on your posts isn't counted.
// Nothing is estimated or filled in; empty data says so.

type Post = { id: string; body: string; kind?: string; media_type?: string | null; created_at: string; reactions: number; comments: number };
type Pair = [number, number];
type Analytics = {
  generated_at: string;
  member_since: string;
  visits_counted_since: string | null;
  kpis: { posts: number; reactions: number; comments: number; engagers: number; bookmarks: number; collection_saves: number; reposts: number; visits_30d: number; best_streak: number; streak: number };
  weekly: { week: string; posts: number; reactions: number; comments: number; engagers: number; new_engagers: number; visits: number }[];
  daily: { day: string; reactions: number; comments: number; posts: number }[];
  hours: number[] | null;
  reaction_kinds: Record<string, number>;
  types: Record<string, { posts: number; avg_reactions: number; avg_comments: number }>;
  top: Post[];
  recent: Post[];
  posts: Post[];
  consistency: string[];
  windows: Record<"7" | "30" | "90", { reactions: Pair; comments: Pair; posts: Pair; engagers: Pair; visits: Pair }>;
  bests: { post: Post | null; week: { week: string; engagement: number } | null; streak: number };
  range: { from: string; to: string; posts: number; reactions: number; comments: number; engagers: number; visits: number };
};

const REACT_LABEL: Record<string, string> = { heart: "❤️ Heart", skull: "💀 Skull", fire: "🔥 Fire", clown: "🤡 Clown", cap: "🧢 Cap", crying: "😭 Crying", salute: "🫡 Salute", w: "W", l: "L" };
const TYPE_LABEL: Record<string, string> = { text: "Text", image: "Image", video: "Video", gif: "GIF", poll: "Poll" };
const WIDGET_LABEL: Record<Widget, string> = {
  kpis: "Totals", reach: "Reach", engagement: "Engagement", new_engagers: "New people engaging", compare: "Compare posts", types: "Content types",
  week: "This week", month: "This month", top: "Top posts", recent: "Recent posts", timeline: "Daily timeline", hours: "Audience hours",
  visits: "Profile visits", reaction_kinds: "Reactions by kind", comments: "Comments", consistency: "Posting days", history: "90-day comparison",
  type_perf: "Performance by type", summary: "Summary", milestones: "Milestones", bests: "Personal bests", range: "Date range", growth: "Growth",
};
const wk = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function AnalyticsPage() {
  return (
    <Gate>
      <Analytics />
    </Gate>
  );
}

function Card({ title, note, children, wide }: { title: string; note?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={clsx("card min-w-0 p-4", wide && "sm:col-span-2")}>
      <h3 className="text-sm font-bold">{title}</h3>
      {note && <p className="mb-2 text-[11px] text-muted">{note}</p>}
      <div className={note ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function PostRows({ posts, empty }: { posts: Post[]; empty: string }) {
  if (!posts.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="divide-y divide-line">
      {posts.map((p) => (
        <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
          <Link href={`/post/${p.id}`} className="min-w-0 flex-1 truncate hover:text-brand">{p.body || "(no text)"}</Link>
          <span className="shrink-0 text-xs text-muted [font-variant-numeric:tabular-nums]">{p.reactions} reactions · {p.comments} comments</span>
        </li>
      ))}
    </ol>
  );
}

function Compare({ a }: { a: Analytics }) {
  const [x, setX] = useState(a.posts[0]?.id ?? "");
  const [y, setY] = useState(a.posts[1]?.id ?? "");
  if (a.posts.length < 2) return <p className="text-sm text-muted">Post at least twice to compare posts.</p>;
  const px = a.posts.find((p) => p.id === x)!;
  const py = a.posts.find((p) => p.id === y)!;
  return (
    <div className="grid grid-cols-2 gap-2">
      {[[x, setX, px], [y, setY, py]].map(([v, set, p], i) => (
        <div key={i} className="space-y-2">
          <select value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} aria-label={`Post ${i + 1}`} className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-xs">
            {a.posts.map((o) => <option key={o.id} value={o.id}>{(o.body || "(no text)").slice(0, 40)}</option>)}
          </select>
          <StatTile label="Reactions" value={(p as Post)?.reactions ?? 0} />
          <StatTile label="Comments" value={(p as Post)?.comments ?? 0} />
        </div>
      ))}
    </div>
  );
}

function Range({ initial }: { initial: Analytics["range"] }) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const { data } = useRpc<Analytics>("get_creator_analytics", { p_from: from, p_to: to }, { keepPreviousData: true });
  const r = data?.range ?? initial;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-xs">
        <label className="flex items-center gap-1">From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded border border-line bg-bg px-1.5 py-1" /></label>
        <label className="flex items-center gap-1">To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded border border-line bg-bg px-1.5 py-1" /></label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatTile label="Posts" value={r.posts} /><StatTile label="Reactions" value={r.reactions} /><StatTile label="Comments" value={r.comments} />
        <StatTile label="People engaging" value={r.engagers} /><StatTile label="Profile visits" value={r.visits} />
      </div>
    </div>
  );
}

function WidgetView({ w, a, me }: { w: Widget; a: Analytics; me: MyPro }) {
  const weeks = a.weekly.map((x) => wk(x.week));
  const visitsNote = a.visits_counted_since ? `Counted since ${new Date(a.visits_counted_since).toLocaleDateString()}. Visits from the same member count once a day; who visited is never recorded.` : "Visits are counted from the day this feature switched on. None yet. Who visited is never recorded.";
  const win = (n: "7" | "30" | "90", label: string) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatTile label="Reactions" value={a.windows[n].reactions[0]} prev={a.windows[n].reactions[1]} period={label} />
      <StatTile label="Comments" value={a.windows[n].comments[0]} prev={a.windows[n].comments[1]} period={label} />
      <StatTile label="Posts" value={a.windows[n].posts[0]} prev={a.windows[n].posts[1]} period={label} />
      <StatTile label="People engaging" value={a.windows[n].engagers[0]} prev={a.windows[n].engagers[1]} period={label} />
    </div>
  );
  switch (w) {
    case "kpis":
      return (
        <Card title="Totals" wide note="All time, from other members only.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Posts" value={a.kpis.posts} /><StatTile label="Reactions" value={a.kpis.reactions} />
            <StatTile label="Comments" value={a.kpis.comments} /><StatTile label="People engaging" value={a.kpis.engagers} />
            <StatTile label="Bookmarks" value={a.kpis.bookmarks} /><StatTile label="Saved to collections" value={a.kpis.collection_saves} />
            <StatTile label="Reposts" value={a.kpis.reposts} /><StatTile label="Profile visits (30 days)" value={a.kpis.visits_30d} />
          </div>
        </Card>
      );
    case "reach":
      return <Card title="Reach" note="Different members who reacted to or commented on your posts, per week. YORU doesn't track views of posts."><TimeChart title="Reach per week" bars labels={weeks} series={[{ key: "e", label: "People engaging", color: "var(--viz-1)", values: a.weekly.map((x) => x.engagers) }]} /></Card>;
    case "new_engagers":
    case "growth":
      return (
        <Card title={w === "growth" ? "Growth" : "New people engaging"} note="YORU has no follower count. This counts members engaging with your posts for the first time, per week.">
          <TimeChart title="New people engaging per week" bars labels={weeks} series={[{ key: "n", label: "New people", color: "var(--viz-1)", values: a.weekly.map((x) => x.new_engagers) }]} />
        </Card>
      );
    case "engagement":
    case "comments":
      return (
        <Card title={w === "comments" ? "Comments" : "Engagement"} note="Per week, last 12 weeks.">
          <TimeChart title="Engagement per week" labels={weeks} series={w === "comments"
            ? [{ key: "c", label: "Comments", color: "var(--viz-1)", values: a.weekly.map((x) => x.comments) }]
            : [{ key: "r", label: "Reactions", color: "var(--viz-1)", values: a.weekly.map((x) => x.reactions) }, { key: "c", label: "Comments", color: "var(--viz-2)", values: a.weekly.map((x) => x.comments) }]} />
        </Card>
      );
    case "timeline":
      return (
        <Card title="Daily timeline" note="Last 30 days." wide>
          <TimeChart title="Daily reactions and comments" labels={a.daily.map((x) => wk(x.day))}
            series={[{ key: "r", label: "Reactions", color: "var(--viz-1)", values: a.daily.map((x) => x.reactions) }, { key: "c", label: "Comments", color: "var(--viz-2)", values: a.daily.map((x) => x.comments) }]} />
        </Card>
      );
    case "visits":
      return <Card title="Profile visits" note={visitsNote}><TimeChart title="Profile visits per week" bars labels={weeks} series={[{ key: "v", label: "Visits", color: "var(--viz-1)", values: a.weekly.map((x) => x.visits) }]} /></Card>;
    case "hours":
      return (
        <Card title="Audience hours" note="When reactions and comments arrive, by hour (UTC), last 90 days.">
          {a.hours ? <TimeChart title="Activity by hour" bars labels={a.hours.map((_, h) => `${h}:00`)} series={[{ key: "h", label: "Activity", color: "var(--viz-1)", values: a.hours }]} />
            : <p className="text-sm text-muted">Not enough activity yet to show a pattern (it needs 20 reactions or comments in 90 days).</p>}
        </Card>
      );
    case "reaction_kinds": {
      const rows = Object.entries(a.reaction_kinds).sort((p, q) => q[1] - p[1]).map(([k, v]) => ({ label: REACT_LABEL[k] ?? k, value: v }));
      return <Card title="Reactions by kind">{rows.length ? <BarList rows={rows} /> : <p className="text-sm text-muted">No reactions from others yet.</p>}</Card>;
    }
    case "types":
    case "type_perf": {
      const rows = Object.entries(a.types).sort((p, q) => q[1].posts - p[1].posts);
      if (!rows.length) return <Card title={WIDGET_LABEL[w]}><p className="text-sm text-muted">No posts yet.</p></Card>;
      return (
        <Card title={WIDGET_LABEL[w]} note={w === "type_perf" ? "Average per post, from other members." : undefined}>
          {w === "types" ? <BarList rows={rows.map(([k, v]) => ({ label: TYPE_LABEL[k] ?? k, value: v.posts }))} /> : (
            <table className="w-full text-left text-xs [font-variant-numeric:tabular-nums]">
              <thead className="text-muted"><tr><th className="py-1 font-semibold">Type</th><th className="text-right font-semibold">Posts</th><th className="text-right font-semibold">Avg reactions</th><th className="text-right font-semibold">Avg comments</th></tr></thead>
              <tbody>{rows.map(([k, v]) => <tr key={k} className="border-t border-line"><td className="py-1">{TYPE_LABEL[k] ?? k}</td><td className="text-right">{v.posts}</td><td className="text-right">{v.avg_reactions}</td><td className="text-right">{v.avg_comments}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      );
    }
    case "week":
      return <Card title="This week" wide note="Last 7 days against the 7 before.">{win("7", "previous 7 days")}</Card>;
    case "month":
      return <Card title="This month" wide note="Last 30 days against the 30 before.">{win("30", "previous 30 days")}</Card>;
    case "history":
      return <Card title="90-day comparison" wide note="Last 90 days against the 90 before.">{win("90", "previous 90 days")}</Card>;
    case "top":
      return <Card title="Top posts" wide><PostRows posts={a.top} empty="No reactions or comments from others yet." /></Card>;
    case "recent":
      return <Card title="Recent posts" wide><PostRows posts={a.recent} empty="You haven't posted yet." /></Card>;
    case "compare":
      return <Card title="Compare posts" wide><Compare a={a} /></Card>;
    case "consistency":
      return <Card title="Posting days" note="Days you posted, last 12 weeks."><DayGrid days={new Set(a.consistency)} /></Card>;
    case "bests":
      return (
        <Card title="Personal bests" wide>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="Longest streak (nights)" value={a.bests.streak} />
            <StatTile label="Best week (reactions + comments)" value={a.bests.week?.engagement ?? 0} />
            <div className="rounded-xl bg-card-2 p-3 text-sm">
              <div className="text-xs text-muted">Best post</div>
              {a.bests.post ? <Link href={`/post/${a.bests.post.id}`} className="line-clamp-2 font-semibold hover:text-brand">{a.bests.post.body || "(no text)"}</Link> : <span className="text-muted">Not yet</span>}
            </div>
          </div>
        </Card>
      );
    case "milestones":
      return (
        <Card title="Milestones" wide note={`${Object.keys(me.milestones).length} of 20 earned.`}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {milestones.map((m) => (
              <div key={m.id} className="flex flex-col items-center text-center" title={m.p.rule}>
                <MilestoneEmblem p={m.p} earned={Boolean(me.milestones[m.p.key])} size={38} />
                <span className="mt-1 line-clamp-1 text-[10px] font-semibold">{m.name}</span>
                <span className="text-[9px] text-muted">{me.milestones[m.p.key] ? "Earned" : `${Math.min(me.progress[m.p.key] ?? 0, m.p.goal)}/${m.p.goal}`}</span>
              </div>
            ))}
          </div>
        </Card>
      );
    case "range":
      return <Card title="Date range" wide><Range initial={a.range} /></Card>;
    case "summary": {
      const w7 = a.windows["7"];
      const best = Object.entries(a.types).sort((p, q) => q[1].avg_reactions + q[1].avg_comments - (p[1].avg_reactions + p[1].avg_comments))[0];
      const lines = a.kpis.posts === 0 ? ["You haven't posted yet, so there's nothing to summarise."] : [
        `You've posted ${a.kpis.posts} time${a.kpis.posts === 1 ? "" : "s"}, and ${a.kpis.engagers} member${a.kpis.engagers === 1 ? " has" : "s have"} reacted or commented.`,
        `In the last 7 days: ${w7.reactions[0]} reactions and ${w7.comments[0]} comments (the week before: ${w7.reactions[1]} and ${w7.comments[1]}).`,
        best ? `${TYPE_LABEL[best[0]] ?? best[0]} posts get the most engagement per post (${(best[1].avg_reactions + best[1].avg_comments).toFixed(1)} on average).` : "",
        a.kpis.streak ? `You're on a ${a.kpis.streak}-night streak.` : "",
      ].filter(Boolean);
      return <Card title="Summary" wide><ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">{lines.map((l) => <li key={l}>{l}</li>)}</ul></Card>;
    }
  }
}

function Board({ kind, a, me }: { kind: "dashboard" | "insight"; a: Analytics; me: MyPro }) {
  const { toastError } = useApp();
  const list = kind === "dashboard" ? dashboards : insightLayouts;
  const eq = me.equips[kind];
  const [pick, setPick] = useState<string>(eq?.active ? eq.item : list[0].id);
  const cur = item<BoardP>(pick) as Item<BoardP>;
  const owned = ownsItem(cur, me);
  const customKey = kind === "dashboard" ? "dashboard_widgets" : "insight_widgets";
  const widgets = cur.p.custom && me.settings[customKey]?.length ? (me.settings[customKey] as Widget[]) : cur.p.widgets;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={kind === "dashboard" ? "Dashboard" : "Insight layout"} className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm">
          {list.map((d) => <option key={d.id} value={d.id}>{d.name}{ownsItem(d, me) ? "" : d.unlock === "pro" ? " (Pro)" : " (earned)"}</option>)}
        </select>
        {owned && eq?.item !== pick && <Button variant="outline" onClick={() => equip(kind, pick).catch(toastError)}>Make default</Button>}
      </div>
      <p className="text-xs text-muted">{cur.desc}</p>
      {!owned ? (
        <div className="card flex items-center gap-2 p-4 text-sm"><Lock size={16} /> This layout is part of YORU Pro. Your numbers are always yours: the free layouts show them too.</div>
      ) : (
        <>
          {cur.p.custom && (
            <div className="card p-3">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Your widgets</div>
              <div className="flex flex-wrap gap-1.5">
                {WIDGETS.map((w) => {
                  const on = widgets.includes(w);
                  return (
                    <button key={w} type="button" aria-pressed={on} disabled={!on && widgets.length >= 12}
                      onClick={() => saveProSettings({ [customKey]: on ? widgets.filter((x) => x !== w) : [...widgets, w] }).catch(toastError)}
                      className={clsx("rounded-full border px-2.5 py-1 text-xs font-semibold", on ? "border-brand bg-brand text-white" : "border-line")}>
                      {WIDGET_LABEL[w]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{widgets.map((w) => <WidgetView key={w} w={w} a={a} me={me} />)}</div>
        </>
      )}
    </div>
  );
}

function Analytics() {
  const { available } = useProUniverse();
  const { data: me } = useMyPro();
  const { data: a, error, isValidating } = useRpc<Analytics>(available ? "get_creator_analytics" : null, {}, { keepPreviousData: true });
  const [tab, setTab] = useState<"dashboard" | "insight">("dashboard");
  if (!available) return <Empty emoji="📈" text="Analytics switch on with the next database update." />;
  if (error) return <Empty emoji="📉" text={`Couldn't load your numbers: ${error.message}`} />;
  if (!a || !me) return <ChaosLoader />;
  return (
    <div className={clsx("space-y-4 transition-opacity", isValidating && "opacity-80")}>
      <div>
        <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
        <h1 className="text-2xl font-black">Analytics</h1>
        <p className="text-sm text-muted">Only your own numbers, only from real activity by other members. Updated {new Date(a.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</p>
      </div>
      <div className="text-xs text-muted">Total posts: {compact(a.kpis.posts)} · member since {new Date(a.member_since).toLocaleDateString()}</div>
      <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="tablist">
        {([["dashboard", "Creator Analytics"], ["insight", "Profile Insights"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx("flex-1 rounded-full py-2 text-sm font-bold", tab === k ? "bg-brand text-white" : "text-muted")}>{l}</button>
        ))}
      </div>
      <Board key={tab} kind={tab} a={a} me={me} />
    </div>
  );
}
