"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/client/api";
import { FEED_REFRESH_EVENT, useRpc } from "@/lib/client/hooks";
import { useShell } from "@/components/shell/AppShell";
import { Empty, PostSkeleton } from "@/components/ui/bits";
import type { Post } from "@/lib/types";
import { Feed } from "./Feed";
import { PostCard } from "./PostCard";

// For You. With Moonrise on (Watchtower -> Controls), pages come from
// get_for_you: your interests, your circle, trending, and the Moonrise lane
// (posts in their first tests). Each page sends the ids already shown, so a
// scroll never repeats. With Moonrise off it is the trending feed as before.

const PAGE = 15;
const MAX_PAGES = 40;

export function ForYouFeed({ emptyText }: { emptyText?: string }) {
  const { data: moon, error } = useRpc<{ enabled: boolean }>("get_moonrise", {}, { revalidateOnFocus: false });
  const [broken, setBroken] = useState(false);
  const onBroken = useCallback(() => setBroken(true), []);
  if (!moon && !error) {
    return (
      <>
        <PostSkeleton />
        <PostSkeleton />
      </>
    );
  }
  if (!moon?.enabled || broken) return <Feed key="for_you_trending" mode="trending" emptyText={emptyText} />;
  return <NightFeed emptyText={emptyText} onBroken={onBroken} />;
}

function NightFeed({ emptyText, onBroken }: { emptyText?: string; onBroken: () => void }) {
  const { me } = useShell();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("loading");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const ids = useRef<string[]>([]);
  const pages = useRef(0);
  const busy = useRef(false);
  const gen = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (reset = false) => {
      if (busy.current && !reset) return;
      busy.current = true;
      const g = reset ? ++gen.current : gen.current;
      if (reset) {
        ids.current = [];
        pages.current = 0;
      }
      setStatus("loading");
      try {
        const first = ids.current.length === 0;
        const [page, own] = await Promise.all([
          rpc<Post[]>("get_for_you", { p_seen: ids.current.slice(-300), p_limit: PAGE, p_hour: new Date().getHours() }),
          // what you just posted comes first, so it's never buried
          first
            ? rpc<Post[]>("get_feed", { p_mode: "user", p_arg: me.username, p_limit: 3 })
                .then((r) => r.filter((p) => Date.now() - new Date(p.created_at).getTime() < 30 * 60_000))
                .catch(() => [] as Post[])
            : Promise.resolve([] as Post[]),
        ]);
        if (g !== gen.current) return;
        const known = new Set(ids.current);
        const fresh: Post[] = [];
        for (const p of [...own, ...page]) {
          if (known.has(p.id)) continue;
          known.add(p.id);
          fresh.push(p);
        }
        ids.current.push(...fresh.map((p) => p.id));
        pages.current += 1;
        setPosts((prev) => (reset || !prev ? fresh : [...prev, ...fresh]));
        setStatus(page.length === 0 || pages.current >= MAX_PAGES ? "done" : "idle");
      } catch {
        if (g !== gen.current) return;
        onBroken(); // e.g. the database is in read-only maintenance: the trending feed still works
      } finally {
        if (g === gen.current) busy.current = false;
      }
    },
    [me.username, onBroken],
  );

  useEffect(() => {
    // fetching the first page on mount: its result arrives asynchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
  }, [load]);

  useEffect(() => {
    const onRefresh = () => load(true);
    window.addEventListener(FEED_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FEED_REFRESH_EVENT, onRefresh);
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || status !== "idle") return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && load(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [status, load]);

  const list = (posts ?? []).filter((p) => !hidden.has(p.id));
  return (
    <div className="relative">
      {!posts && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}
      {posts && list.length === 0 && status === "done" && <Empty text={emptyText ?? "Nothing here yet."} />}
      {list.map((p) => (
        <PostCard key={p.id} post={p} onDeleted={(id) => setHidden((h) => new Set(h).add(id))} />
      ))}
      <div ref={sentinel} />
      {posts && status === "loading" && <PostSkeleton />}
      {status === "done" && list.length > 3 && <p className="py-8 text-center text-[13px] text-muted">You&apos;re all caught up.</p>}
    </div>
  );
}
