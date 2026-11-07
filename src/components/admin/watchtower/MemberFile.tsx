"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Search, ShieldCheck, Undo2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ChaosLoader, Empty, TimeAgo } from "@/components/ui/bits";
import type { NwEvent } from "@/lib/nightwatch";
import type { ProfileLite } from "@/lib/types";
import { CaseCard, accountAge } from "./CaseCard";

type File = {
  profile: ProfileLite & { created_at: string; role: string; banned: boolean; muted_until: string | null; bio: string; last_seen_at: string | null };
  counts: { posts: number; comments: number; reports_against: number; reports_filed: number; reports_filed_dismissed: number };
  strikes: { id: string; label: string; severity: number; created_at: string; expires_at: string; revoked_at: string | null; active: boolean }[];
  events: NwEvent[];
  ban_recommended: boolean;
};

// Member file: everything Night Watch knows about one account, and the
// actions a moderator (mute, strikes) or admin (ban, roles) can take.
export function NwMembers({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const { data: results } = useRpc<ProfileLite[]>(q.trim().length >= 2 ? "search_profiles" : null, { p_q: q.trim() });
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-card-2 px-3 py-2">
          <Search size={16} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="Find a member" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" aria-label="Find a member" />
        </label>
        <ul className="mt-2 divide-y divide-line/70">
          {results?.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect(p.id)} className={clsx("flex w-full items-center gap-2.5 px-1 py-2 text-start hover:bg-card-2", selected === p.id && "bg-card-2")}>
                <Avatar src={p.avatar_url} name={p.display_name} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium">{p.display_name}</span>
                  <span className="block truncate text-[12px] text-muted">@{p.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {selected ? <MemberFile id={selected} /> : <Empty text="Search for a member, or open one from a case." />}
    </div>
  );
}

function MemberFile({ id }: { id: string }) {
  const { me } = useShell();
  const { toast, toastError } = useApp();
  const { data, error, mutate } = useRpc<File>("nw_member_file", { p_user_id: id });
  const isAdmin = me.role === "owner" || me.role === "admin";
  if (error) return <Empty text={error.message} />;
  if (!data) return <ChaosLoader />;
  const p = data.profile;
  const muted = p.muted_until && new Date(p.muted_until) > new Date();
  const staff = p.role === "owner" || p.role === "admin";

  const act = async (fn: string, args: Record<string, unknown>, msg: string) => {
    try {
      await rpc(fn, args);
      toast(msg, "success");
      mutate();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line p-4">
        <div className="flex items-center gap-3">
          <Avatar src={p.avatar_url} name={p.display_name} size={52} />
          <div className="min-w-0 flex-1">
            <Link href={`/u/${p.username}`} className="block truncate text-[16px] font-semibold hover:underline">
              {p.display_name}
            </Link>
            <p className="truncate text-[12.5px] text-muted">
              @{p.username} · {p.role} · joined {accountAge(p.created_at)}
              {p.last_seen_at && <> · seen <TimeAgo iso={p.last_seen_at} /></>}
            </p>
          </div>
          {p.banned ? (
            <span className="rounded-md bg-brand px-2 py-0.5 text-[11px] font-bold text-white">BANNED</span>
          ) : muted ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">MUTED</span>
          ) : (
            <span className="flex items-center gap-1 text-[12px] text-online">
              <ShieldCheck size={14} /> Active
            </span>
          )}
        </div>
        {p.bio && <p className="mt-2 text-[13px] text-ink-2">{p.bio}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          {[
            ["Posts", data.counts.posts],
            ["Comments", data.counts.comments],
            ["Reported", data.counts.reports_against],
            ["Reports filed", data.counts.reports_filed],
            ["Filed, dismissed", data.counts.reports_filed_dismissed],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-card-2 py-2">
              <div className="text-[17px] font-semibold tabular-nums">{v}</div>
              <div className="text-[11px] text-muted">{l}</div>
            </div>
          ))}
        </div>
        {data.ban_recommended && !p.banned && (
          <p className="mt-3 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2 text-[13px]">Night Watch recommends a ban review: four active strikes, or a child-safety strike.</p>
        )}
        {!staff && (
          <div className="mt-3 flex flex-wrap gap-2">
            {muted ? (
              <Button variant="outline" onClick={() => act("nw_mute", { p_user_id: p.id, p_minutes: 0 }, "Unmuted.")}>
                <Undo2 size={15} /> Unmute
              </Button>
            ) : (
              [
                [60, "1 hour"],
                [1440, "24 hours"],
                [10080, "7 days"],
              ].map(([m, l]) => (
                <Button key={m} variant="outline" onClick={() => act("nw_mute", { p_user_id: p.id, p_minutes: m }, `Muted for ${l}.`)}>
                  <VolumeX size={15} /> {l}
                </Button>
              ))
            )}
            {isAdmin && (
              <Button
                variant="danger"
                onClick={() => {
                  if (!p.banned && !confirm(`Ban @${p.username}? They lose access right away. You can unban later.`)) return;
                  act("admin_set_banned", { p_user_id: p.id, p_banned: !p.banned }, p.banned ? "Unbanned." : "Banned.");
                }}
              >
                <Ban size={15} /> {p.banned ? "Unban" : "Ban"}
              </Button>
            )}
            {isAdmin && p.role !== "admin" && (
              <Button variant="ghost" onClick={() => act("admin_set_role", { p_user_id: p.id, p_role: p.role === "moderator" ? "member" : "moderator" }, p.role === "moderator" ? "No longer a moderator." : "Now a moderator.")}>
                {p.role === "moderator" ? "Remove moderator" : "Make moderator"}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line p-4">
        <h3 className="text-[14px] font-semibold">Strikes</h3>
        {data.strikes.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">None.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line/70">
            {data.strikes.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span className={clsx("h-2 w-2 rounded-full", s.active ? (s.severity >= 3 ? "bg-brand" : "bg-amber-500") : "bg-line")} />
                <span className="font-medium">{s.label}</span>
                <span className="text-muted">
                  · <TimeAgo iso={s.created_at} /> · {s.revoked_at ? "revoked" : s.active ? `until ${new Date(s.expires_at).toLocaleDateString()}` : "expired"}
                </span>
                {s.active && (
                  <button type="button" onClick={() => act("nw_revoke_strike", { p_strike_id: s.id }, "Strike revoked.")} className="ms-auto text-[12.5px] text-muted hover:text-ink">
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line p-4">
        <h3 className="text-[14px] font-semibold">History</h3>
        {data.events.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No moderation history.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line/70">
            {data.events.map((e) => (
              <li key={e.id} className="py-3">
                <CaseCard e={e} compact />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
