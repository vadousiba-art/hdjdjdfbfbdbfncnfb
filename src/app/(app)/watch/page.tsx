"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bookmark, Clapperboard, Heart, MessageCircle, Send, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { mediaSrc, rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { useT } from "@/components/providers/I18nProvider";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/ui/bits";
import { RichText } from "@/components/ui/RichText";
import { Modal } from "@/components/ui/Modal";
import { VideoPlayer, setVideoMuted, useVideoMuted } from "@/components/media/VideoPlayer";
import { CommentThread } from "@/components/feed/CommentThread";
import type { Post } from "@/lib/types";

const PAGE = 6;
type Mode = "for_you" | "latest";

function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}

// Watch: full-screen vertical video, one clip per swipe (like TikTok).
export default function WatchPage() {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>("for_you");
  const muted = useVideoMuted();
  const scroller = useRef<HTMLDivElement>(null);
  const { data, setSize, isValidating } = useSWRInfinite<Post[]>(
    (i, prev) => (prev && prev.length < PAGE ? null : ["watch", mode, i * PAGE]),
    ([, m, offset]: [string, Mode, number]) => rpc<Post[]>("get_watch", { p_mode: m, p_offset: offset, p_limit: PAGE }),
    { revalidateFirstPage: false, revalidateOnFocus: false },
  );
  const seen = new Set<string>();
  const posts = (data ?? []).flat().filter((p) => !seen.has(p.id) && seen.add(p.id));
  const done = data && data[data.length - 1]?.length < PAGE;

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Keyboard: up/down moves between clips, m toggles sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scroller.current;
      if (!el || (e.target as HTMLElement)?.closest("input,textarea,[role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "j") el.scrollBy({ top: el.clientHeight, behavior: "smooth" });
      if (e.key === "ArrowUp" || e.key === "k") el.scrollBy({ top: -el.clientHeight, behavior: "smooth" });
      if (e.key === "m") setVideoMuted(!muted);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [muted]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || done || isValidating) return;
    if (el.scrollTop + el.clientHeight * 2.5 > el.scrollHeight) setSize((n) => n + 1);
  };

  if (typeof document === "undefined") return null;
  // Portaled: the page transition's transform would otherwise trap "fixed".
  return createPortal(
    <div className="fixed inset-0 z-[35] bg-black text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <button type="button" onClick={() => router.back()} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10" aria-label="Back">
          <ArrowLeft size={24} />
        </button>
        <div className="pointer-events-auto flex gap-5" role="tablist" aria-label="Watch feed">
          {([["for_you", t("feed.forYou")], ["latest", t("feed.latest")]] as [Mode, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => {
                setMode(key);
                scroller.current?.scrollTo({ top: 0 });
              }}
              className={clsx("relative py-2 text-[16px] font-semibold drop-shadow", mode === key ? "text-white" : "text-white/55")}
            >
              {label}
              {mode === key && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-white" />}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setVideoMuted(!muted)} className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10" aria-label={muted ? "Turn sound on" : "Mute"}>
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </button>
      </div>

      <div ref={scroller} onScroll={onScroll} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0">
        {!data && (
          <div className="flex h-full items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        )}
        {data && posts.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <Clapperboard size={34} strokeWidth={1.5} className="text-white/70" />
            <p className="text-lg font-semibold">No videos yet</p>
            <p className="max-w-xs text-sm text-white/65">Videos people post show up here, one per swipe. Post one and you&apos;re first.</p>
            <Link href="/" className="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
              Back to Home
            </Link>
          </div>
        )}
        {posts.map((p) => (
          <Clip key={p.id} post={p} />
        ))}
        {done && posts.length > 0 && (
          <div className="flex h-[40vh] snap-start items-center justify-center text-sm text-white/60">You&apos;ve seen every video. Check back later.</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Clip({ post: initial }: { post: Post }) {
  const { toast, toastError } = useApp();
  const { me } = useShell();
  const [post, setPost] = useState(initial);
  const [comments, setComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [burst, setBurst] = useState(0);
  const liked = post.my_reactions.includes("heart");

  async function like(force?: boolean) {
    if (force && liked) return setBurst((n) => n + 1);
    const had = liked;
    setPost((p) => ({
      ...p,
      my_reactions: had ? p.my_reactions.filter((k) => k !== "heart") : [...p.my_reactions, "heart"],
      counts: { ...p.counts, likes: Math.max(0, p.counts.likes + (had ? -1 : 1)) },
    }));
    if (!had) setBurst((n) => n + 1);
    try {
      await rpc("toggle_reaction", { p_post_id: post.id, p_kind: "heart" });
    } catch (err) {
      setPost(initial);
      toastError(err);
    }
  }
  async function save() {
    const was = post.bookmarked;
    setPost((p) => ({ ...p, bookmarked: !was }));
    try {
      await rpc("toggle_bookmark", { p_post_id: post.id });
      toast(was ? "Removed from bookmarks." : "Saved to bookmarks.", "success");
    } catch (err) {
      setPost(initial);
      toastError(err);
    }
  }
  async function share() {
    const url = `${location.origin}/post/${post.id}`;
    try {
      if (navigator.share) return void (await navigator.share({ title: "YORU", url }));
    } catch {
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => null);
    toast("Link copied.", "success");
  }

  const action = "flex flex-col items-center gap-1 text-[12px] font-semibold drop-shadow";
  return (
    <section className="relative flex h-full snap-start snap-always items-center justify-center" aria-label={`Video by ${post.author.display_name}`}>
      <div className="relative h-full w-full max-w-[min(100%,calc(100dvh*9/16))] lg:my-4 lg:h-[calc(100%-2rem)] lg:overflow-hidden lg:rounded-2xl">
        <VideoPlayer src={mediaSrc(post.media_url)!} fill tapToPause label={`Video by ${post.author.display_name}`} onDoubleTap={() => like(true)} />
        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 1.1] }}
              transition={{ duration: 0.8 }}
              onAnimationComplete={() => setBurst(0)}
              aria-hidden
            >
              <Heart size={110} className="fill-white text-white drop-shadow-[0_6px_30px_rgb(0_0_0/0.5)]" />
            </motion.span>
          )}
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/75 to-transparent" aria-hidden />

        <div className="absolute bottom-4 end-2 flex flex-col items-center gap-5">
          <Link href={`/u/${post.author.username}`} aria-label={post.author.display_name} className="mb-1 rounded-full ring-2 ring-white">
            <Avatar src={post.author.avatar_url} name={post.author.display_name} size={46} />
          </Link>
          <button type="button" onClick={() => like()} className={action} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}>
            <Heart size={33} className={liked ? "fill-heart text-heart" : "fill-white text-white"} />
            {compact(post.counts.likes)}
          </button>
          <button type="button" onClick={() => setComments(true)} className={action} aria-label={`${post.counts.comments} comments`}>
            <MessageCircle size={32} className="-scale-x-100 fill-white text-white" />
            {compact(post.counts.comments)}
          </button>
          <button type="button" onClick={save} className={action} aria-label={post.bookmarked ? "Remove bookmark" : "Bookmark"} aria-pressed={post.bookmarked}>
            <Bookmark size={31} className={post.bookmarked ? "fill-amber-400 text-amber-400" : "fill-white text-white"} />
            Save
          </button>
          <button type="button" onClick={share} className={action} aria-label="Share">
            <Send size={30} className="text-white" />
            Share
          </button>
        </div>

        <div className="absolute bottom-4 start-3 end-20">
          <Link href={`/u/${post.author.username}`} className="flex items-center gap-1 text-[16px] font-bold drop-shadow">
            {post.author.username}
            {post.author.verified && <VerifiedBadge size={15} />}
          </Link>
          {post.body && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 block text-start">
              <RichText text={post.body} className={clsx("whitespace-pre-wrap text-[14.5px] leading-snug text-white/95 drop-shadow", !expanded && "line-clamp-2")} />
            </button>
          )}
          {post.author.id === me.id && post.mod?.state === "held" && (
            <p className="mt-2 inline-block rounded-md bg-amber-500/90 px-2 py-0.5 text-[12px] font-semibold text-black">Under review: only you can see this</p>
          )}
        </div>
      </div>
      <Modal open={comments} onClose={() => setComments(false)} title={`${post.counts.comments} comments`}>
        <div className="max-h-[65vh] overflow-y-auto">
          <CommentThread postId={post.id} />
        </div>
      </Modal>
    </section>
  );
}
