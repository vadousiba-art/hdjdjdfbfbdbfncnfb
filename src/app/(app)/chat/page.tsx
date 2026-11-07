"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, Lock, MessageCircle, Plus, Search, Users } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { useLive } from "@/components/providers/LiveProvider";
import { useT } from "@/components/providers/I18nProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Empty, TimeAgo } from "@/components/ui/bits";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { OFFICIAL_ID } from "@/lib/nightwatch";
import type { Channel } from "@/lib/types";
import { PushPrompt } from "@/components/notifications/PushPrompt";

// Inbox (like Discord): a rail of your group chats on the left, direct
// messages on the right with who's active now, and YORU's official notices
// pinned at the top when there are any.
export default function InboxPage() {
  const t = useT();
  const { data, mutate } = useRpc<Channel[]>("get_channels");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  useLive((e) => e.type === "message" && mutate());

  const all = data ?? [];
  const official = all.find((c) => c.kind === "dm" && c.dm_user?.id === OFFICIAL_ID);
  const groups = all.filter((c) => c.kind === "group" && c.is_member);
  const joinable = all.filter((c) => c.kind === "group" && !c.is_member);
  const dms = all.filter((c) => c.kind === "dm" && c !== official);
  const active = dms.filter((c) => c.dm_user?.online).slice(0, 8);
  const needle = q.trim().toLowerCase();
  const match = (c: Channel) => !needle || (c.kind === "dm" ? `${c.dm_user?.display_name} ${c.dm_user?.username}` : c.name).toLowerCase().includes(needle);
  const list = [...dms, ...groups].filter(match).sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));

  return (
    <div className="-mx-3 flex min-h-[calc(100dvh-140px)] sm:-mx-4 lg:mx-0">
      {/* Group rail */}
      <nav className="sticky top-[var(--header-h,0px)] flex h-[calc(100dvh-var(--header-h,0px)-64px)] w-[68px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-e border-line/70 py-3 no-scrollbar lg:h-[calc(100dvh-48px)]" aria-label="Group chats">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white" title="Direct messages">
          <MessageCircle size={22} />
          <span className="absolute -start-[10px] h-8 w-1 rounded-e-full bg-ink" aria-hidden />
        </span>
        <span className="h-px w-8 bg-line" aria-hidden />
        {groups.map((g) => (
          <Link key={g.id} href={`/chat/${g.id}`} title={g.name} aria-label={`${g.name}${g.unread ? `, ${g.unread} unread` : ""}`} className="group relative">
            {g.unread > 0 && <span className="absolute -start-[10px] top-1/2 h-2 w-1 -translate-y-1/2 rounded-e-full bg-ink" aria-hidden />}
            <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-card-2 text-[22px] transition-all duration-150 group-hover:rounded-xl group-hover:bg-brand/20">
              {g.emoji}
            </span>
            {g.unread > 0 && (
              <span className="absolute -bottom-0.5 -end-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-[3px] ring-bg">
                {g.unread > 99 ? "99+" : g.unread}
              </span>
            )}
          </Link>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-dashed border-line text-online transition-colors hover:border-online" aria-label="New group or message" title="New chat">
          <Plus size={22} />
        </button>
      </nav>

      {/* Messages */}
      <div className="min-w-0 flex-1 px-3 sm:px-4">
        <div className="flex items-center gap-2 pt-3">
          <h1 className="flex-1 text-[22px] font-bold tracking-tight">{t("nav.inbox")}</h1>
          <button type="button" onClick={() => setSearching((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-ink-2" aria-label="Search messages" aria-pressed={searching}>
            <Search size={18} />
          </button>
          <button type="button" onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13.5px] font-semibold text-bg" aria-label="New message">
            <Plus size={16} strokeWidth={2.6} /> New
          </button>
        </div>
        {searching && (
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people and groups"
            className="mt-3 w-full rounded-xl border border-line bg-card-2 px-3.5 py-2.5 text-[14.5px] outline-none placeholder:text-muted focus:border-ink/40"
          />
        )}

        {!needle && <PushPrompt className="mt-3" />}

        {active.length > 0 && !needle && (
          <section className="mt-4" aria-label="Active now">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Active now</h2>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {active.map((c) => (
                <Link key={c.id} href={`/chat/${c.id}`} className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-card-2/70 px-2 py-3 hover:bg-card-2">
                  <Avatar src={c.dm_user!.avatar_url} name={c.dm_user!.display_name} size={48} online />
                  <span className="w-full truncate text-center text-[12px] text-ink-2">{c.dm_user!.display_name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!data && (
          <div className="mt-4 space-y-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-32" />
                  <div className="skeleton h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-col">
          {official && !needle && <Row c={official} official />}
          {list.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}>
              <Row c={c} />
            </motion.div>
          ))}
        </div>
        {data && list.length === 0 && !official && <Empty text={needle ? "No chats match that." : "No messages yet. Start one with someone you know."} />}

        {joinable.length > 0 && !needle && (
          <section className="mt-6 pb-4" aria-label="Open groups">
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
              <Users size={13} /> Open groups
            </h2>
            {joinable.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </section>
        )}
      </div>
      <NewChatDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Row({ c, official }: { c: Channel; official?: boolean }) {
  const title = c.kind === "dm" ? (c.dm_user?.display_name ?? "Direct message") : c.name;
  const unread = c.unread > 0;
  return (
    <Link
      href={`/chat/${c.id}`}
      className={clsx("-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors duration-150 hover:bg-card-2", official && "mb-1 bg-card-2/60")}
    >
      {c.kind === "dm" && c.dm_user ? (
        <Avatar src={c.dm_user.avatar_url} name={c.dm_user.display_name} size={50} online={official ? undefined : c.dm_user.online} />
      ) : (
        <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-[18px] bg-card-2 text-2xl">{c.emoji}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={clsx("truncate text-[15px]", unread ? "font-semibold text-ink" : "font-medium text-ink")}>{title}</span>
          {official && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[#5865f2] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">
              <BadgeCheck size={11} /> Official
            </span>
          )}
          {c.is_private && c.kind === "group" && <Lock size={12} className="shrink-0 text-muted" />}
          {c.last_message && <TimeAgo iso={c.last_message.created_at} className="ms-auto shrink-0 text-[12px] text-muted" />}
        </div>
        <p className={clsx("truncate text-[13.5px]", unread ? "font-medium text-ink-2" : "text-muted")}>
          {c.last_message ? (
            <>
              {c.kind === "group" && <span className="text-ink-2">{c.last_message.author}: </span>}
              {c.last_message.body}
            </>
          ) : c.is_member ? (
            "No messages yet"
          ) : (
            `${c.member_count} members · tap to join`
          )}
        </p>
      </div>
      {unread && (
        <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{c.unread}</span>
      )}
    </Link>
  );
}
