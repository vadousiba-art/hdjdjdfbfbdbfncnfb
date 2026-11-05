"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Ban, Check, Copy, Shield, SlidersHorizontal, TowerControl, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ChaosLoader, Empty, PageTitle, TimeAgo } from "@/components/ui/bits";
import { AdminOverviewPanel } from "@/components/admin/Overview";
import { SiteControls } from "@/components/admin/SiteControls";
import { AuditLog } from "@/components/admin/AuditLog";
import { SupportInbox } from "@/components/admin/SupportInbox";
import { MemberToolsDialog } from "@/components/admin/MemberTools";
import { LevelChip } from "@/components/yoru/Progression";
import type { AdminOverview, MemberExtras, ProfileLite } from "@/lib/types";
import { useOpenGates } from "@/lib/client/gates";
import { AdminCreators, AdminPro } from "@/components/admin/OpenGatesAdmin";
import en from "@/lib/i18n/messages/en";
import { isStaff } from "@/components/shell/navItems";
import { NwDashboardPanel } from "@/components/admin/watchtower/Dashboard";
import { NwQueue } from "@/components/admin/watchtower/Queue";
import { NwAppeals } from "@/components/admin/watchtower/Appeals";
import { NwRules } from "@/components/admin/watchtower/Rules";
import { NwMembers } from "@/components/admin/watchtower/MemberFile";
import { AdminPayments } from "@/components/admin/Payments";
import { useETransfer } from "@/lib/client/etransfer";

type Tab = "nw" | "queue" | "appeals" | "people" | "rules" | "overview" | "controls" | "members" | "invites" | "reports" | "creators" | "pro" | "payments" | "inbox" | "log";
type ReportFlag = { category: string; escalated: boolean; same_target: number };

export default function AdminPage() {
  const { me } = useShell();
  const { toast, toastError } = useApp();
  const isAdmin = me.role === "owner" || me.role === "admin";
  const { data, error, mutate } = useRpc<AdminOverview>(isAdmin ? "admin_overview" : null);
  const [tab, setTab] = useState<Tab>("nw");
  const [person, setPerson] = useState<string | null>(null);
  const openPerson = (id: string) => {
    setPerson(id);
    setTab("people");
  };
  const [tools, setTools] = useState<ProfileLite | null>(null);
  const { data: extras } = useRpc<Record<string, MemberExtras>>(isAdmin ? "admin_member_extras" : null);
  const [maxUses, setMaxUses] = useState(5);
  const [hours, setHours] = useState(168);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { available: gates } = useOpenGates();
  // e-Transfer payments (migration 0016): the owner's money, so the owner's tab
  const { available: payments } = useETransfer();
  const showPayments = payments && me.role === "owner";
  const { data: flags, mutate: mutateFlags } = useRpc<Record<string, ReportFlag>>(gates && isAdmin ? "admin_report_flags" : null);

  if (!isStaff(me.role)) return <Empty text="Watchtower is for the YORU team." />;
  const nwTabs: [Tab, string][] = [
    ["nw", "Night Watch"],
    ["queue", "Queue"],
    ["appeals", "Appeals"],
    ["people", "Members"],
    ["rules", "Rules"],
  ];
  const nwView = (
    <>
      {tab === "nw" && <NwDashboardPanel onGoto={setTab} onMember={openPerson} />}
      {tab === "queue" && <NwQueue onMember={openPerson} />}
      {tab === "appeals" && <NwAppeals onMember={openPerson} />}
      {tab === "people" && <NwMembers selected={person} onSelect={setPerson} />}
      {tab === "rules" && <NwRules canEdit={isAdmin} />}
    </>
  );
  const header = (
    <div className="pt-1">
      <h1 className="flex items-center gap-2 text-[24px] font-bold tracking-tight">
        <TowerControl size={24} /> Watchtower
      </h1>
      <p className="mt-0.5 text-[13.5px] text-muted">Night Watch moderation{isAdmin ? ", site controls, members and the audit log" : ""}.</p>
    </div>
  );
  const tabButton = ([id, label]: readonly [Tab, string]) => (
    <button
      key={id}
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={clsx(
        "relative shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors duration-150",
        tab === id ? "bg-ink font-semibold text-bg" : "text-ink-2 hover:bg-card-2",
      )}
    >
      {label}
    </button>
  );
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        {header}
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
          {nwTabs.map(tabButton)}
        </div>
        {nwView}
      </div>
    );
  }
  if (error) return <Empty emoji="🛂" text={error.message} />;
  if (!data) return <ChaosLoader />;

  const link = (code: string) => `${location.origin}/join/${code}`;
  const act = async (fn: string, args: Record<string, unknown>, msg: string, emoji = "✅") => {
    try {
      await rpc(fn, args);
      toast(msg, "success", emoji);
      mutate();
    } catch (err) {
      toastError(err);
    }
  };

  async function createInvite() {
    setBusy(true);
    try {
      const r = await rpc<{ code: string }>("admin_create_invite", { p_max_uses: maxUses, p_expires_hours: hours, p_note: note });
      await navigator.clipboard?.writeText(link(r.code)).catch(() => null);
      toast("Invite created & copied. Choose your recruits wisely.", "chaos", "🎟️");
      setNote("");
      mutate();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  const openReports = data.reports.filter((r) => r.status === "open").length;
  const inviteState = (i: AdminOverview["invites"][number]) =>
    i.revoked ? "revoked" : i.uses >= i.max_uses ? "used up" : i.expires_at && new Date(i.expires_at) < new Date() ? "expired" : "active";

  return (
    <div className="space-y-4">
      {header}
      <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1" role="tablist">
        {nwTabs.map(tabButton)}
        <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden />
        {(
          [
            ["overview", "Stats"],
            ["controls", "Controls"],
            ["members", `Members (${data.members.length})`],
            ["invites", "Invites"],
            ["reports", `Reports${openReports ? ` (${openReports})` : ""}`],
            ...(gates ? ([["creators", "Creators"], ["pro", "Pro"]] as const) : []),
            ...(showPayments ? ([["payments", "Payments"]] as const) : []),
            ["inbox", "Support"],
            ["log", "Audit log"],
          ] as const
        ).map(tabButton)}
      </div>
      {nwView}

      {tab === "overview" && <AdminOverviewPanel onGoto={setTab} />}
      {tab === "controls" && <SiteControls />}
      {tab === "log" && <AuditLog />}
      {tab === "inbox" && <SupportInbox />}

      {tab === "invites" && (
        <>
          <div className="card space-y-3 p-4">
            <div className="font-bold">Create invite link</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold text-muted">
                Max uses
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
              </label>
              <label className="text-xs font-bold text-muted">
                Expires
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                >
                  <option value={24}>24 hours</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                  <option value={0}>Never</option>
                </select>
              </label>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 80))}
              placeholder="Note (e.g. 'for Ethan's cousin, God help us')"
              className="w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <Button variant="chaos" onClick={createInvite} disabled={busy} className="w-full">
              {busy ? "Forging..." : "Create & copy link"}
            </Button>
          </div>
          {data.invites.length === 0 && <Empty emoji="🎟️" text="No invites yet. It's a very exclusive club of you." />}
          <div className="space-y-2">
            {data.invites.map((i) => {
              const state = inviteState(i);
              return (
                <div key={i.code} className={clsx("card p-3", state !== "active" && "opacity-60")}>
                  <div className="flex items-center gap-2">
                    <code className="rounded-lg bg-card-2 px-2 py-1 font-mono text-sm">{i.code}</code>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                        state === "active" ? "bg-online/15 text-online" : "bg-hot/15 text-hot",
                      )}
                    >
                      {state}
                    </span>
                    <span className="ml-auto text-xs text-muted">
                      {i.uses}/{i.max_uses} used
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {i.note && <>“{i.note}” · </>}by {i.created_by ?? "?"} · <TimeAgo iso={i.created_at} />
                    {i.expires_at && <> · expires {new Date(i.expires_at).toLocaleDateString()}</>}
                  </div>
                  {state === "active" && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        className="py-1.5 text-xs"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(link(i.code)).catch(() => null);
                          toast("Invite link copied.", "success", "🔗");
                        }}
                      >
                        <Copy size={14} /> Copy link
                      </Button>
                      <Button variant="ghost" className="py-1.5 text-xs text-hot" onClick={() => act("admin_revoke_invite", { p_code: i.code }, "Invite revoked.", "🚫")}>
                        <X size={14} /> Revoke
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "members" && (
        <div className="space-y-2">
          {data.members.map((m) => (
            <motion.div key={m.id} layout className={clsx("card flex flex-wrap items-center gap-3 p-3", m.banned && "border-hot/50")}>
              <Link href={`/u/${m.username}`}>
                <Avatar src={m.avatar_url} name={m.display_name} size={42} online={m.online} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-bold">
                  {m.display_name} {m.verified && "✅"} <LevelChip level={extras?.[m.id]?.level} />
                  {extras?.[m.id]?.flair && <span className="text-xs font-normal text-brand-2">{extras[m.id].flair}</span>}
                  {m.banned && <span className="text-xs text-hot">BANNED</span>}
                  {extras?.[m.id]?.muted_until && <span className="text-xs font-normal text-muted">muted</span>}
                </div>
                <div className="truncate text-xs text-muted">
                  @{m.username} · {m.role} · {m.posts} posts · seen {m.last_seen_at ? <TimeAgo iso={m.last_seen_at} /> : "never"}
                </div>
              </div>
              <Button variant="outline" className="py-1.5 text-xs" onClick={() => setTools(m)} aria-label={`More tools for ${m.display_name}`}>
                <SlidersHorizontal size={14} /> Tools
              </Button>
              {m.role !== "owner" && m.id !== me.id && (
                <div className="flex flex-wrap gap-1.5">
                  {data.my_role === "owner" && (
                    <Button
                      variant="outline"
                      className="py-1.5 text-xs"
                      onClick={() =>
                        act("admin_set_role", { p_user_id: m.id, p_role: m.role === "admin" ? "member" : "admin" }, m.role === "admin" ? "Demoted. Humbled." : "Promoted to admin. Power corrupts.", "👑")
                      }
                    >
                      <Shield size={14} /> {m.role === "admin" ? "Demote" : "Make admin"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="py-1.5 text-xs"
                    onClick={() => act("admin_set_verified", { p_user_id: m.id, p_verified: !m.verified }, m.verified ? "Verification revoked." : "Verified. Officially real.", "✅")}
                  >
                    <Check size={14} /> {m.verified ? "Unverify" : "Verify"}
                  </Button>
                  <Button
                    variant={m.banned ? "outline" : "danger"}
                    className="py-1.5 text-xs"
                    onClick={() => {
                      if (!m.banned && !confirm(`Ban @${m.username}? They lose all access immediately.`)) return;
                      act("admin_set_banned", { p_user_id: m.id, p_banned: !m.banned }, m.banned ? "Unbanned. Second chances." : "Member banned.", "🔨");
                    }}
                  >
                    <Ban size={14} /> {m.banned ? "Unban" : "Ban"}
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-2">
          {data.reports.length === 0 && <Empty emoji="😇" text="No reports. Suspiciously wholesome." />}
          {[...data.reports]
            .sort((a, b) => Number(b.status === "open" && !!flags?.[b.id]?.escalated) - Number(a.status === "open" && !!flags?.[a.id]?.escalated))
            .map((r) => (
            <div key={r.id} className={clsx("card p-3", r.status !== "open" && "opacity-60", r.status === "open" && flags?.[r.id]?.escalated && "border-brand")}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-hot/15 px-2 py-0.5 font-bold uppercase text-hot">{r.target_type}</span>
                {flags?.[r.id] && (
                  <span className="rounded-full bg-card-2 px-2 py-0.5 font-semibold">
                    {en[`report.${flags[r.id].category}` as keyof typeof en] ?? flags[r.id].category}
                  </span>
                )}
                {flags?.[r.id]?.escalated && <span className="rounded-full bg-brand px-2 py-0.5 font-bold text-white">ESCALATED</span>}
                {(flags?.[r.id]?.same_target ?? 0) > 1 && <span className="text-muted">{flags![r.id].same_target} reporters</span>}
                <span className="text-muted">
                  reported by <b className="text-ink">{r.reporter.display_name}</b> · <TimeAgo iso={r.created_at} />
                </span>
                <span className="ms-auto font-bold uppercase text-muted">{r.status}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold">“{r.reason}”</p>
              {r.target ? (
                <div className="mt-2 rounded-xl border border-line bg-card-2 p-2 text-sm">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <Avatar src={r.target.author.avatar_url} name={r.target.author.display_name} size={20} />
                    <b>{r.target.author.display_name}</b>
                    {r.target.deleted && <span className="text-hot">(already removed)</span>}
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap">{r.target.body || (r.target.media_url ? "[media]" : "[empty]")}</p>
                  {r.target_type === "post" && (
                    <Link href={`/post/${r.target_id}`} className="mt-1 inline-block text-xs font-bold text-brand">
                      Open post
                    </Link>
                  )}
                  {r.target_type === "comment" && r.target.post_id && (
                    <Link href={`/post/${r.target.post_id}`} className="mt-1 inline-block text-xs font-bold text-brand">
                      Open thread
                    </Link>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">Target no longer exists.</p>
              )}
              {r.status === "open" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" className="py-1.5 text-xs" onClick={() => act("admin_resolve_report", { p_report_id: r.id, p_action: "dismiss" }, "Dismissed.", "🙄")}>
                    Dismiss
                  </Button>
                  {flags?.[r.id] && (
                    <Button
                      variant="outline"
                      className="py-1.5 text-xs"
                      onClick={async () => {
                        await act("admin_escalate_report", { p_report_id: r.id, p_escalated: !flags[r.id].escalated }, flags[r.id].escalated ? "No longer escalated." : "Escalated.", "🚩");
                        mutateFlags();
                      }}
                    >
                      {flags[r.id].escalated ? "De-escalate" : "Escalate"}
                    </Button>
                  )}
                  {r.target_type !== "user" && (
                    <Button variant="outline" className="py-1.5 text-xs text-hot" onClick={() => act("admin_resolve_report", { p_report_id: r.id, p_action: "delete" }, "Content deleted.", "🗑️")}>
                      <Trash2 size={14} /> Delete content
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="py-1.5 text-xs"
                    onClick={() => confirm("Delete the content and ban the author?") && act("admin_resolve_report", { p_report_id: r.id, p_action: "ban" }, "Removed and banned.", "🔨")}
                  >
                    <Ban size={14} /> {r.target_type === "user" ? "Ban user" : "Delete + ban"}
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">Action: {r.action}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {tab === "creators" && gates && <AdminCreators />}
      {tab === "pro" && gates && <AdminPro members={data.members} />}
      {tab === "payments" && showPayments && <AdminPayments />}
      <MemberToolsDialog
        key={tools?.id ?? "none"}
        member={tools}
        extras={tools ? extras?.[tools.id] : undefined}
        canModerate={!!tools && tools.id !== me.id && tools.role !== "owner" && (tools.role !== "admin" || data.my_role === "owner")}
        onClose={() => setTools(null)}
      />
    </div>
  );
}
