"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, UserPlus } from "lucide-react";
import clsx from "clsx";
import { useSWRConfig } from "swr";
import { rpc } from "@/lib/client/api";
import { byFn, useRpc } from "@/lib/client/hooks";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ChaosLoader, VerifiedBadge } from "@/components/ui/bits";
import { Modal } from "@/components/ui/Modal";
import type { FollowState, ProfileLite } from "@/lib/types";

// Following (migration 0017): you get a notification when someone you follow
// posts. Follows never change how far a post travels in Moonrise.

export function useFollow(userId: string | null) {
  return useRpc<FollowState>(userId ? "get_follow_state" : null, { p_user: userId });
}

export function FollowButton({ userId, username }: { userId: string; username: string }) {
  const { toastError } = useApp();
  const { data, mutate } = useFollow(userId);
  const { mutate: mutateAll } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const following = !!data?.i_follow;

  async function toggle() {
    if (!data || busy) return;
    setBusy(true);
    const next = { ...data, i_follow: !following, followers: Math.max(0, data.followers + (following ? -1 : 1)) };
    mutate(next, { revalidate: false });
    try {
      const fresh = await rpc<FollowState>(following ? "unfollow_user" : "follow_user", { p_user: userId });
      mutate(fresh, { revalidate: false });
      mutateAll(byFn("list_follows"));
    } catch (err) {
      mutate(data, { revalidate: false });
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.94 }}
      disabled={!data}
      aria-pressed={following}
      aria-label={following ? `Unfollow @${username}` : `Follow @${username}`}
      className={clsx(
        "relative inline-flex h-10 min-w-[7.5rem] items-center justify-center gap-1.5 overflow-hidden rounded-full px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        following ? "border border-line bg-card text-ink hover:border-hot/60 hover:text-hot" : "bg-ink text-bg hover:opacity-90",
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={following ? (hover ? "unfollow" : "following") : "follow"}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="inline-flex items-center gap-1.5"
        >
          {following ? (
            hover ? (
              "Unfollow"
            ) : (
              <>
                <Check size={16} /> Following
              </>
            )
          ) : (
            <>
              <UserPlus size={16} /> {data?.follows_me ? "Follow back" : "Follow"}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** "12 followers · 30 following", each opening the list. */
export function FollowCounts({ userId }: { userId: string }) {
  const { data } = useFollow(userId);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  if (!data) return <div className="mt-2 h-5" aria-hidden />;
  return (
    <>
      <div className="mt-2 flex items-center gap-3 text-[14px]">
        <button type="button" onClick={() => setList("followers")} className="hover:underline">
          <b className="font-bold tabular-nums">{data.followers}</b> <span className="text-muted">{data.followers === 1 ? "follower" : "followers"}</span>
        </button>
        <button type="button" onClick={() => setList("following")} className="hover:underline">
          <b className="font-bold tabular-nums">{data.following}</b> <span className="text-muted">following</span>
        </button>
        {data.follows_me && <span className="rounded-full bg-card-2 px-2 py-0.5 text-[11.5px] font-medium text-muted">Follows you</span>}
      </div>
      <FollowList userId={userId} kind={list} onClose={() => setList(null)} />
    </>
  );
}

function FollowList({ userId, kind, onClose }: { userId: string; kind: "followers" | "following" | null; onClose: () => void }) {
  const { data } = useRpc<ProfileLite[]>(kind ? "list_follows" : null, { p_user: userId, p_kind: kind, p_limit: 100 });
  return (
    <Modal open={kind !== null} onClose={onClose} title={kind === "following" ? "Following" : "Followers"}>
      {!data && <ChaosLoader />}
      {data && data.length === 0 && <p className="py-6 text-center text-sm text-muted">{kind === "following" ? "Not following anyone yet." : "No followers yet."}</p>}
      <ul className="-mx-2">
        {data?.map((u, i) => (
          <motion.li key={u.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.3) }}>
            <Link href={`/u/${u.username}`} onClick={onClose} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-card-2">
              <Avatar src={u.avatar_url} name={u.display_name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate font-semibold">
                  {u.display_name} {u.verified && <VerifiedBadge size={14} />}
                </span>
                <span className="block truncate text-[13px] text-muted">@{u.username}</span>
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </Modal>
  );
}
