"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { CalendarClock, FileText, Lock, Plus, Send, Trash2, X } from "lucide-react";
import { useSWRConfig } from "swr";
import { Gate } from "@/components/yoru/Gate";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { rpc } from "@/lib/client/api";
import { byFn, refreshFeeds, useRpc } from "@/lib/client/hooks";
import { ITEM_BY_ID, draftTemplates, item, plannerTemplates, type DraftP, type PlannerP } from "@/lib/pro/catalog";
import { ownsItem, useMyPro, useProUniverse } from "@/lib/client/pro";
import { RarityChip } from "@/components/pro/ui";

// Draft Studio (09) and Post Planner (17). Drafts are private to their owner.
// Nothing is published without an explicit action: "Post now", or a schedule
// the member set, which the server publishes as them.

type Draft = {
  id: string;
  template: string | null;
  folder: string;
  kind: "post" | "poll";
  body: string;
  media_url: string | null;
  link_url: string | null;
  poll_options: string[] | null;
  status: "draft" | "scheduled" | "published" | "failed";
  scheduled_at: string | null;
  timezone: string | null;
  plan: string | null;
  attempts: number;
  error: string | null;
  post_id: string | null;
  published_at: string | null;
  updated_at: string;
};

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export default function StudioPage() {
  return (
    <Gate>
      <Suspense fallback={<ChaosLoader />}>
        <Studio />
      </Suspense>
    </Gate>
  );
}

function Studio() {
  const { available } = useProUniverse();
  const { data: me } = useMyPro();
  const { data: drafts, mutate } = useRpc<Draft[]>(available ? "pro_get_drafts" : null);
  const { toast, toastError } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>("all");
  const plan = params.get("plan");
  const [tab, setTab] = useState<"drafts" | "calendar" | "templates" | "planner">(() => (plan ? "planner" : "drafts"));

  async function create(template: string | null, extra: Partial<Draft> = {}) {
    const t = item<DraftP>(template);
    try {
      const d = await rpc<Draft>("pro_save_draft", {
        p_id: null,
        p: {
          template,
          kind: t?.p.kind ?? "post",
          body: (extra.body ?? t?.p.body ?? "") + (t?.p.tags.length ? `\n\n${t.p.tags.map((x) => `#${x}`).join(" ")}` : ""),
          poll_options: t?.p.options ?? null,
          folder: extra.folder ?? "",
          plan: extra.plan ?? null,
        },
      });
      await mutate();
      setEditing(d.id);
      setTab("drafts");
      return d;
    } catch (err) {
      toastError(err);
      return null;
    }
  }

  // ?template=draft.x from the catalog starts a draft right away (once).
  const want = params.get("template");
  useEffect(() => {
    if (!available || !drafts || !want) return;
    router.replace("/pro/studio");
    const t = setTimeout(() => void create(want), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, drafts, want]);

  if (!available) return <Empty emoji="🗒️" text="Draft Studio switches on with the next database update." />;
  if (!drafts || !me) return <ChaosLoader />;

  const folders = [...new Set(drafts.map((d) => d.folder).filter(Boolean))];
  const shown = drafts.filter((d) => folder === "all" || d.folder === folder);
  const open = drafts.find((d) => d.id === editing) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
          <h1 className="text-2xl font-black">Draft Studio</h1>
          <p className="text-sm text-muted">Private drafts, templates and a planner. Only you can see them.</p>
        </div>
        <Button onClick={() => create(null)}><Plus size={16} /> New</Button>
      </div>
      <p className={clsx("rounded-xl border p-3 text-xs", me.scheduler.running ? "border-online/40 bg-online/10 text-ink-2" : "border-line bg-card-2 text-ink-2")}>
        {me.scheduler.running
          ? `Scheduling is running. Scheduled posts go out within about a minute of their time. Up to ${me.limits.scheduled} at once, ${me.limits.drafts} drafts.`
          : "Scheduling isn't running on this server right now, so you can't schedule yet. Drafts still save, and you can post them yourself."}
      </p>

      <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="tablist">
        {(["drafts", "calendar", "templates", "planner"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={clsx("flex-1 rounded-full py-2 text-sm font-bold capitalize", tab === k ? "bg-brand text-white" : "text-muted")}>
            {k}
          </button>
        ))}
      </div>

      {tab === "drafts" && (
        <>
          {folders.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {["all", ...folders].map((f) => (
                <button key={f} type="button" onClick={() => setFolder(f)} aria-pressed={folder === f}
                  className={clsx("rounded-full border px-2.5 py-1 text-xs font-semibold", folder === f ? "border-brand bg-brand text-white" : "border-line")}>
                  {f === "all" ? "All folders" : f}
                </button>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <Empty emoji="🗒️" text="No drafts yet. Start one, or pick a template." />
          ) : (
            <ul className="space-y-2">
              {shown.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => setEditing(d.id)} className="card w-full p-3 text-left hover:border-brand">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusChip d={d} />
                      {d.folder && <span className="text-muted">📁 {d.folder}</span>}
                      {d.plan && <span className="text-muted">· {d.plan}</span>}
                      <span className="ms-auto text-muted">{new Date(d.scheduled_at ?? d.updated_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm">{d.body || <span className="text-muted">Empty draft</span>}</div>
                    {d.error && <div className="mt-1 text-xs text-hot">Couldn&apos;t post: {d.error}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "calendar" && <Calendar drafts={drafts} onOpen={(id) => { setEditing(id); setTab("drafts"); }} />}

      {tab === "templates" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {draftTemplates.map((t) => {
            const owned = ownsItem(t, me);
            return (
              <button key={t.id} type="button" disabled={!owned} onClick={() => create(t.id)}
                className="card p-3 text-left hover:border-brand disabled:opacity-60" style={{ borderTopColor: t.p.accent, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-bold">{t.name}</span>
                  {owned ? <RarityChip r={t.rarity} /> : <Lock size={13} aria-label="Part of YORU Pro" />}
                </div>
                <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-muted">{t.p.body || t.desc}</div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "planner" && <Planner initial={plan} me={me} onCreate={create} drafts={drafts} reload={mutate} />}

      {open && (
        <Editor key={open.id} d={open} onClose={() => setEditing(null)} reload={mutate} schedulerOn={me.scheduler.running}
          onPosted={() => { toast("Posted.", "success", "🌙"); refreshFeeds(); }} />
      )}
    </div>
  );
}

function StatusChip({ d }: { d: Draft }) {
  const map = {
    draft: ["Draft", "bg-card-2 text-ink-2"],
    scheduled: ["Scheduled", "bg-brand/15 text-brand"],
    published: ["Posted", "bg-online/15 text-online"],
    failed: ["Failed", "bg-hot/15 text-hot"],
  } as const;
  const [l, c] = map[d.status];
  return <span className={clsx("rounded-full px-2 py-0.5 font-bold", c)}>{l}</span>;
}

function Editor({ d, onClose, reload, onPosted, schedulerOn }: { d: Draft; onClose: () => void; reload: () => Promise<unknown>; onPosted: () => void; schedulerOn: boolean }) {
  const { me, openComposer } = useShell();
  const { toast, toastError } = useApp();
  const { mutate } = useSWRConfig();
  const [body, setBody] = useState(d.body);
  const [kind, setKind] = useState(d.kind);
  const [options, setOptions] = useState<string[]>(d.poll_options ?? ["", ""]);
  const [folder, setFolder] = useState(d.folder);
  const [at, setAt] = useState(() => localInput(d.scheduled_at ? new Date(d.scheduled_at) : new Date(Date.now() + 3600_000)));
  const [busy, setBusy] = useState(false);
  const accent = item<DraftP>(d.template)?.p.accent ?? "var(--brand)";
  const locked = d.status === "published";
  const dirty = body !== d.body || kind !== d.kind || folder !== d.folder || JSON.stringify(options) !== JSON.stringify(d.poll_options ?? ["", ""]);

  async function save() {
    await rpc("pro_save_draft", { p_id: d.id, p: { body, kind, folder, poll_options: kind === "poll" ? options.map((o) => o.trim()).filter(Boolean) : null } });
    await reload();
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (err) { toastError(err); } finally { setBusy(false); }
  }

  return (
    <div className="card overflow-hidden" style={{ borderColor: accent }}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-bold"><FileText size={16} /> {item(d.template)?.name ?? "Draft"} <StatusChip d={d} /></div>
        <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-card-2" aria-label="Close editor"><X size={18} /></button>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={locked} rows={8} maxLength={2000} aria-label="Draft text"
            className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-[15px] outline-none focus:border-brand" />
          <div className="flex items-center justify-between text-xs text-muted"><span>{body.length}/2000</span>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={kind === "poll"} disabled={locked} onChange={(e) => setKind(e.target.checked ? "poll" : "post")} /> Poll</label>
          </div>
          {kind === "poll" && (
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <input key={i} value={o} maxLength={80} disabled={locked} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm" />
              ))}
              {options.length < 6 && !locked && <button type="button" onClick={() => setOptions([...options, ""])} className="text-xs font-bold text-brand">+ Option</button>}
            </div>
          )}
          <input value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={40} disabled={locked} placeholder="Folder (optional)" aria-label="Folder"
            className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Preview</div>
          <div className="rounded-2xl border border-line bg-card p-3">
            <div className="flex gap-2.5">
              <Avatar src={me.avatar_url} name={me.display_name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-sm"><b>{me.display_name}</b> <span className="text-muted">@{me.username} · now</span></div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px]">{body || <span className="text-muted">Nothing yet</span>}</div>
                {kind === "poll" && <div className="mt-2 space-y-1">{options.filter(Boolean).map((o) => <div key={o} className="rounded-full border border-line px-3 py-1 text-sm">{o}</div>)}</div>}
              </div>
            </div>
          </div>
          {d.status === "scheduled" && d.scheduled_at && (
            <p className="mt-2 text-sm"><CalendarClock size={14} className="me-1 inline" /> Scheduled for {new Date(d.scheduled_at).toLocaleString()} ({d.timezone ?? "your time"})</p>
          )}
          {d.status === "failed" && <p className="mt-2 text-sm text-hot">Couldn&apos;t post after {d.attempts} tries: {d.error} Edit the draft to try again.</p>}
          {d.status === "published" && d.post_id && <p className="mt-2 text-sm">Posted {d.published_at && new Date(d.published_at).toLocaleString()}. <Link href={`/post/${d.post_id}`} className="font-bold text-brand">View post</Link></p>}
        </div>
      </div>
      {!locked && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Button variant="outline" disabled={busy || !dirty} onClick={() => run(async () => { await save(); toast("Draft saved.", "success", "🗒️"); })}>Save</Button>
          <Button disabled={busy} onClick={() => run(async () => {
            if (!confirm("Post this now?")) return;
            if (dirty) await save();
            const opts = kind === "poll" ? options.map((o) => o.trim()).filter(Boolean) : null;
            await rpc("create_post", { p_body: body, p_poll_options: opts && opts.length >= 2 ? opts : null });
            await rpc("pro_delete_draft", { p_id: d.id });
            await reload();
            await mutate(byFn("get_feed"));
            onPosted();
            onClose();
          })}><Send size={16} /> Post now</Button>
          <Button variant="outline" disabled={busy} onClick={() => openComposer({ text: body })} title="Add a photo or video in the composer">Open in composer</Button>
          <span className="mx-1 h-6 w-px bg-line" />
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} disabled={!schedulerOn} aria-label="Schedule time"
            className="rounded-lg border border-line bg-bg px-2 py-1.5 text-sm" />
          <Button variant="outline" disabled={busy || !schedulerOn} title={schedulerOn ? undefined : "Scheduling isn't running right now"}
            onClick={() => run(async () => {
              if (dirty) await save();
              await rpc("pro_schedule_draft", { p_id: d.id, p_at: new Date(at).toISOString(), p_timezone: tz() });
              await reload();
              toast(`Scheduled for ${new Date(at).toLocaleString()}.`, "success", "🗓️");
            })}><CalendarClock size={16} /> {d.status === "scheduled" ? "Reschedule" : "Schedule"}</Button>
          {d.status === "scheduled" && (
            <Button variant="outline" disabled={busy} onClick={() => run(async () => { await rpc("pro_schedule_draft", { p_id: d.id, p_at: null }); await reload(); toast("Schedule cancelled. It's a draft again.", "info", "↩"); })}>Cancel schedule</Button>
          )}
          <Button variant="danger" className="ms-auto" disabled={busy} onClick={() => run(async () => {
            if (!confirm("Delete this draft?")) return;
            await rpc("pro_delete_draft", { p_id: d.id });
            await reload();
            onClose();
          })}><Trash2 size={16} /></Button>
        </div>
      )}
    </div>
  );
}

function Calendar({ drafts, onOpen }: { drafts: Draft[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const byDay = new Map<string, Draft[]>();
  for (const d of drafts) {
    const at = d.scheduled_at ?? d.published_at;
    if (!at || d.status === "draft") continue;
    const k = new Date(at).toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), d]);
  }
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-full px-2 py-1 text-sm font-bold hover:bg-card-2" aria-label="Previous month">‹</button>
        <div className="font-bold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-full px-2 py-1 text-sm font-bold hover:bg-card-2" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const list = byDay.get(day.toDateString()) ?? [];
          const other = day.getMonth() !== month.getMonth();
          return (
            <div key={day.toISOString()} className={clsx("min-h-14 rounded-lg border border-line p-1 text-left", other && "opacity-40", day.toDateString() === new Date().toDateString() && "border-brand")}>
              <div className="text-[10px] font-bold">{day.getDate()}</div>
              {list.slice(0, 2).map((d) => (
                <button key={d.id} type="button" onClick={() => onOpen(d.id)} className={clsx("mt-0.5 block w-full truncate rounded px-1 text-left text-[9px] font-semibold", d.status === "published" ? "bg-online/15" : d.status === "failed" ? "bg-hot/15" : "bg-brand/15")}>
                  {new Date(d.scheduled_at ?? d.published_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {d.body.slice(0, 18)}
                </button>
              ))}
              {list.length > 2 && <div className="text-[9px] text-muted">+{list.length - 2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Planner({ initial, me, onCreate, drafts, reload }: {
  initial: string | null; me: NonNullable<ReturnType<typeof useMyPro>["data"]>;
  onCreate: (template: string | null, extra?: Partial<Draft>) => Promise<Draft | null>; drafts: Draft[]; reload: () => Promise<unknown>;
}) {
  const { toast, toastError } = useApp();
  const [pick, setPick] = useState(initial && ITEM_BY_ID[initial]?.cat === "planner" ? initial : plannerTemplates[1].id);
  const [start, setStart] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const tpl = item<PlannerP>(pick)!;
  const owned = ownsItem(tpl, me);
  const slots = tpl.p.slots.map((s) => {
    const [h, m] = s.time.split(":").map(Number);
    const d = new Date(`${start}T00:00:00`);
    d.setDate(d.getDate() + s.day);
    d.setHours(h, m, 0, 0);
    const draft = item<DraftP>(s.draft);
    return { at: d, draft: draft && ownsItem(draft, me) ? draft.id : "draft.minimal_post", label: draft?.name ?? "Minimal Post" };
  });
  const room = me.limits.scheduled - drafts.filter((d) => d.status === "scheduled").length;

  return (
    <div className="space-y-3">
      <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Plan template" className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm">
        {plannerTemplates.map((p) => <option key={p.id} value={p.id}>{p.name}{ownsItem(p, me) ? "" : p.unlock === "pro" ? " (Pro)" : " (earned)"}</option>)}
      </select>
      <p className="text-sm text-muted">{tpl.desc}</p>
      {tpl.p.cadence === "custom" ? (
        <p className="rounded-xl bg-card-2 p-3 text-sm">Custom schedule: create drafts and pick each time yourself in the editor.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">Start <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-line bg-bg px-2 py-1" /></label>
          <ol className="card divide-y divide-line">
            {slots.map((s, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{s.at.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {s.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="text-muted">{s.label}</span>
              </li>
            ))}
          </ol>
          <label className={clsx("flex items-center gap-2 text-sm", !me.scheduler.running && "opacity-60")}>
            <input type="checkbox" checked={schedule} disabled={!me.scheduler.running} onChange={(e) => setSchedule(e.target.checked)} />
            Also schedule them at these times ({tz()}){!me.scheduler.running && ": scheduling isn't running right now"}
          </label>
          {schedule && slots.length > room && <p className="text-xs text-hot">You can schedule {room} more; the rest will be saved as drafts.</p>}
        </>
      )}
      <Button disabled={!owned || busy} onClick={async () => {
        setBusy(true);
        try {
          if (tpl.p.cadence === "custom") { await onCreate(null, { plan: tpl.name }); return; }
          let scheduled = 0;
          for (const s of slots) {
            const d = await onCreate(s.draft, { plan: tpl.name, folder: tpl.name.slice(0, 40) });
            if (!d) break;
            if (schedule && scheduled < room && s.at.getTime() > Date.now() + 60_000) {
              try {
                await rpc("pro_schedule_draft", { p_id: d.id, p_at: s.at.toISOString(), p_timezone: tz() });
                scheduled++;
              } catch {
                /* stays a draft; scheduling needs text first */
              }
            }
          }
          await reload();
          toast(schedule ? `${slots.length} drafts made, ${scheduled} scheduled. Fill them in before their time.` : `${slots.length} drafts made in “${tpl.name}”.`, "success", "🗓️");
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}>{owned ? "Create this plan" : "Part of YORU Pro"}</Button>
      <p className="text-xs text-muted">Drafts made from a template still contain placeholders like [title]. A scheduled draft posts exactly what it says, so fill them in first.</p>
    </div>
  );
}
