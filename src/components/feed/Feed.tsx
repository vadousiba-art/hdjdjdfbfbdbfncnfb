"use client";

import { useEffect, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Play } from "lucide-react";
import Link from "next/link";
import { mediaSrc, rpc } from "@/lib/client/api";
import { FEED_REFRESH_EVENT } from "@/lib/client/hooks";
import { useLive } from "@/components/providers/LiveProvider";
import { useShell } from "@/components/shell/AppShell";
import { Empty, PostSkeleton } from "@/components/ui/bits";
import { EMPTY_LINES } from "@/lib/jokes";
import type { Post } from "@/lib/types";
import { PostCard } from "./PostCard";

const PAGE = 10;

type Mode = "latest" | "trending" | "user" | "media" | "tag" | "search" | "bookmarks" | "preset" | "interests";
const OFFSET_MODES: Mode[] = ["trending", "preset"];

// A square tile for grid layouts (Pro profile layouts).
function GridTile({ post }: { post: Post }) {
  return (
    <Link href={`/post/${post.id}`} className="relative block aspect-square overflow-hidden bg-card-2" aria-label={post.body ? post.body.slice(0, 80) : "Post"}>
      {post.media_url && post.media_type !== "video" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaSrc(post.media_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : post.media_url ? (
        <>
          <video src={`${mediaSrc(post.media_url)}#t=0.001`} poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <Play size={18} fill="currentColor" className="absolute end-1.5 top-1.5 text-white drop-shadow" aria-hidden />
        </>
      ) : (
        <span className="line-clamp-5 p-2 text-xs text-ink-2">{post.body}</span>
      )}
    </Link>
  );
}

// Infinite feed. Chronological modes page by created_at cursor; trending and
// Pro feed presets page by offset (duplicates are filtered client-side).
export function Feed({ mode = "latest", arg, emptyText, live = false, grid = false, preview = false }: { mode?: Mode; arg?: string; emptyText?: string; live?: boolean; grid?: boolean; preview?: boolean }) {
  const { me } = useShell();
  const sentinel = useRef<HTMLDivElement>(null);
  const [fresh, setFresh] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<Post[]>(
    (index, prev) => {
      if (prev && prev.length < PAGE) return null;
      if (preview && index > 0) return null;
      if (OFFSET_MODES.includes(mode)) return ["feed", mode, arg ?? null, index * PAGE];
      const cursor = index === 0 ? null : prev?.[prev.length - 1]?.created_at;
      return ["feed", mode, arg ?? null, cursor];
    },
    ([, m, a, c]: [string, Mode, string | null, string | number | null]) =>
      m === "interests"
        ? rpc<Post[]>("get_interest_feed", { p_before: c, p_limit: PAGE })
        : m === "preset"
        ? rpc<Post[]>("get_feed_preset", { p_preset: a, p_offset: c ?? 0, p_limit: PAGE, p_preview: preview })
        : m === "trending" && c === 0
          ? // For You: your own posts from the last half hour come first, so
            // what you just posted is never buried under older trending posts.
            Promise.all([
              rpc<Post[]>("get_feed", { p_mode: "user", p_arg: me.username, p_limit: 3 }),
              rpc<Post[]>("get_feed", { p_mode: m, p_arg: a, p_limit: PAGE, p_offset: 0 }),
            ]).then(([mine, top]) => [...mine.filter((p) => Date.now() - new Date(p.created_at).getTime() < 30 * 60_000), ...top])
          : rpc<Post[]>("get_feed", {
              p_mode: m,
              p_arg: a,
              p_limit: PAGE,
              ...(m === "trending" ? { p_offset: c ?? 0 } : { p_before: c }),
            }),
    { revalidateFirstPage: true, revalidateOnFocus: false },
  );

  const seen = new Set<string>();
  const posts = (data ?? []).flat().filter((p) => {
    if (seen.has(p.id) || hidden.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  const done = data && (preview || data[data.length - 1]?.length < PAGE);
  const loadingMore = !done && (isValidating || (data && typeof data[size - 1] === "undefined"));

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isValidating) setSize((s) => s + 1);
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, isValidating, setSize]);

  useEffect(() => {
    const onRefresh = () => mutate();
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh);
  }, [mutate]);

  useLive((e) => {
    if (!live || e.type !== "post") return;
    if (e.author_id === me.id) {
      mutate();
    } else {
      setFresh((n) => n + 1);
    }
  });

  if (error && !data) {
    return <Empty emoji="🛰️" text={`The feed fell over: ${error.message}`} />;
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {fresh > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={() => {
              setFresh(0);
              mutate();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="sticky top-[calc(var(--header-h,0px)+10px)] z-20 mx-auto mt-2 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-bg shadow-lg"
          >
            <ArrowUp size={16} /> {fresh} new {fresh === 1 ? "post" : "posts"}
          </motion.button>
        )}
      </AnimatePresence>
      {!data && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}
      {data && posts.length === 0 && <Empty text={emptyText ?? EMPTY_LINES.feed} />}
      {grid ? (
        <div className="grid grid-cols-3 gap-1">{posts.map((p) => <GridTile key={p.id} post={p} />)}</div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onDeleted={(id) => setHidden((h) => new Set(h).add(id))} />)
      )}
      <div ref={sentinel} />
      {loadingMore && data && <PostSkeleton />}
      {done && posts.length > 3 && (
        <p className="py-8 text-center text-[13px] text-muted">
          You&apos;re all caught up.
        </p>
      )}
    </div>
  );
}
