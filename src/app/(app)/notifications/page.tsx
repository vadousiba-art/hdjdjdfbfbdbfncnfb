"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CheckCheck } from "lucide-react";
import clsx from "clsx";
import { useSWRConfig } from "swr";
import { byFn, useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useLive } from "@/components/providers/LiveProvider";
import { Avatar } from "@/components/ui/Avatar";
import { PushPrompt } from "@/components/notifications/PushPrompt";
import { Button, ChaosLoader, Empty, PageTitle, TimeAgo } from "@/components/ui/bits";
import { AWARD_INFO, EMPTY_LINES, NOTIFICATION_TEXT, REACTION_EMOJI } from "@/lib/jokes";
import { levelTitle } from "@/lib/progress";
import { MOON_EMOJI, splitTopPost } from "@/lib/push";
import { MoonGlyph } from "@/components/moon/MoonGlyph";
import type { AppNotification, AwardKind, ReactionKind } from "@/lib/types";

const ICON: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  reply: "↩️",
  mention: "📣",
  repost: "🔁",
  award: "🏆",
  message: "✉️",
  friend_post: "🆕",
  new_post: "🆕",
  follow: "👤",
  top_post: "🌕",
  moon: "🌕",
  roast: "🔥",
  level_up: "⬆️",
  announcement: "📣",
  system: "🛡️",
  moderation: "🛡️",
  report_update: "🛡️",
};

function href(n: AppNotification) {
  if (n.kind === "level_up") return "/leaderboard";
  if (n.kind === "report_update") return "/standing";
  if (n.post_id) return `/post/${n.post_id}`;
  if (n.channel_id) return `/chat/${n.channel_id}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return "#";
}

export default function NotificationsPage() {
  const { data, mutate } = useRpc<AppNotification[]>("get_notifications", { p_limit: 60 });
  const { mutate: mutateAll } = useSWRConfig();
  useLive((e) => e.type === "notification" && mutate());

  const unread = (data ?? []).filter((n) => !n.read).length;

  async function markAll() {
    await rpc("mark_notifications_read", { p_ids: null }).catch(() => null);
    mutate();
    mutateAll(byFn("get_me"));
  }

  // Opening the page marks things read after a short beat so the badges flash first.
  useEffect(() => {
    if (!unread) return;
    const t = setTimeout(markAll, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  return (
    <div>
      <div className="flex items-start justify-between">
        <PageTitle sub="What happened while you were away.">
          Notifications
        </PageTitle>
        {unread > 0 && (
          <Button variant="outline" onClick={markAll} className="text-xs">
            <CheckCheck size={16} /> Mark all read
          </Button>
        )}
      </div>
      <PushPrompt className="mb-3" />
      {!data && <ChaosLoader />}
      {data && data.length === 0 && <Empty emoji="🧘" text={EMPTY_LINES.notifications} />}
      <div className="-mx-3 sm:-mx-4">
        {data?.map((n, i) => {
          let detail = n.body;
          if (n.kind === "reaction") detail = REACTION_EMOJI[n.body as ReactionKind] ?? n.body;
          if (n.kind === "award") detail = `${AWARD_INFO[n.body as AwardKind]?.emoji ?? "🏆"} ${AWARD_INFO[n.body as AwardKind]?.label ?? n.body}`;
          const top = n.kind === "top_post" ? splitTopPost(n.body) : null;
          if (top) detail = `${top.emoji} ${top.phase} · ${top.text}`;
          const icon = n.kind === "top_post" ? top?.emoji : n.kind === "moon" ? MOON_EMOJI[n.body] : ICON[n.kind];
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              <Link
                href={href(n)}
                className={clsx("flex items-start gap-3 px-3 py-3 transition-colors hover:bg-card-2 sm:px-4", !n.read && "bg-brand/[0.06]")}
              >
                <div className="relative">
                  {n.kind === "level_up" ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">昇</span>
                  ) : n.kind === "moon" ? (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card-2">
                      <MoonGlyph phase={n.body} size={30} />
                    </span>
                  ) : (
                    <Avatar src={n.actor?.avatar_url} name={n.actor?.display_name ?? "?"} size={44} />
                  )}
                  {n.kind !== "moon" && <span className="absolute -bottom-1 -right-1 rounded-full bg-card px-0.5 text-base leading-none">{icon ?? "📢"}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  {n.kind === "level_up" ? (
                    <p className="text-[15px]">
                      <b>Level up!</b> You reached level {n.body} · {levelTitle(Number(n.body)).en}
                    </p>
                  ) : n.kind === "moon" ? (
                    <p className="text-[14.5px] leading-snug">
                      Your post just reached <b className="font-semibold">{MOON_EMOJI[n.body] ?? "🌕"} {n.body}</b>
                    </p>
                  ) : (
                    <p className="text-[14.5px] leading-snug">
                      <b className="font-semibold">{n.actor?.display_name ?? "Someone"}</b> {NOTIFICATION_TEXT[n.kind] ?? n.kind}
                      {n.kind === "reaction" && ` ${detail}`}
                    </p>
                  )}
                  {detail && n.kind !== "reaction" && n.kind !== "like" && n.kind !== "level_up" && n.kind !== "moon" && n.kind !== "follow" && (
                    <p className="mt-0.5 line-clamp-2 text-[13.5px] text-ink-2">{detail}</p>
                  )}
                  <TimeAgo iso={n.created_at} className="text-xs text-muted" />
                </div>
                {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="unread" />}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
