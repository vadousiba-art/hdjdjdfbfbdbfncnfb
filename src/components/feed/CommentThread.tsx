"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Flag, Heart, Loader2, MoreHorizontal, Reply, Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { ai, rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { ProBadgeMark } from "@/components/pro/ProMarks";
import { Empty, NameLink, TimeAgo, VerifiedBadge } from "@/components/ui/bits";
import { RichText } from "@/components/ui/RichText";
import { Menu } from "@/components/ui/Menu";
import { EMPTY_LINES, pickLine, SUCCESS_TOASTS } from "@/lib/jokes";
import type { Comment } from "@/lib/types";
import { ReportDialog } from "./ReportDialog";
import { AtlasAssist } from "@/components/atlas/AtlasAssist";

type Node = Comment & { children: Node[] };

function buildTree(list: Comment[]): Node[] {
  const map = new Map<string, Node>();
  list.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: Node[] = [];
  for (const c of map.values()) {
    const parent = c.parent_id ? map.get(c.parent_id) : null;
    if (parent) parent.children.push(c);
    else roots.push(c);
  }
  return roots;
}

function CommentBox({
  postId,
  parentId,
  onDone,
  autoFocus,
  placeholder = "Add a comment...",
}: {
  postId: string;
  parentId?: string | null;
  onDone: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { me } = useShell();
  const { toast, toastError } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await rpc("add_comment", { p_post_id: postId, p_body: text.trim(), p_parent_id: parentId ?? null });
      setText("");
      toast(pickLine(SUCCESS_TOASTS.comment), "success", "💬");
      onDone();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-2.5">
      <Avatar src={me.avatar_url} name={me.display_name} size={34} />
      <div className="flex flex-1 items-end gap-2 rounded-2xl border border-line bg-card-2 px-3 py-2 focus-within:border-brand">
        <textarea
          autoFocus={autoFocus}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] outline-none placeholder:text-muted"
          aria-label={placeholder}
          dir="auto"
        />
        <AtlasAssist value={text} onUse={(t) => setText(t.slice(0, 1000))} tasks={["comment", "rewrite"]} align="end" />
        <button onClick={send} disabled={!text.trim() || busy} className="text-brand disabled:opacity-40" aria-label="Send comment">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}

function CommentItem({ node, depth, postId, refresh }: { node: Node; depth: number; postId: string; refresh: () => void }) {
  const { me } = useShell();
  const { toastError, toast } = useApp();
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(node.liked);
  const [likes, setLikes] = useState(node.likes);
  const [reporting, setReporting] = useState(false);
  const canDelete = node.author.id === me.id || me.role !== "member";

  async function like() {
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    try {
      await rpc("toggle_comment_like", { p_comment_id: node.id });
    } catch (err) {
      setLiked(liked);
      setLikes(node.likes);
      toastError(err);
    }
  }

  async function remove() {
    if (!confirm("Delete this comment?")) return;
    try {
      await rpc("delete_comment", { p_id: node.id });
      toast("Comment deleted.", "success", "🗑️");
      refresh();
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className={clsx(depth > 0 && "ml-5 border-l-2 border-line pl-3 sm:ml-8")}>
      <div className={clsx("group flex gap-2.5 py-2.5", node.is_ai && "rounded-2xl bg-roast/5 px-2 ring-1 ring-roast/30")}>
        <Link href={`/u/${node.author.username}`}>
          <Avatar src={node.author.avatar_url} name={node.author.display_name} size={34} ring={node.is_ai ? "gradient" : "none"} proRing={node.author.look?.ring} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm">
            <NameLink username={node.author.username} className="font-bold">
              {node.author.display_name}
            </NameLink>
            {node.author.verified && <VerifiedBadge size={14} />}
            <ProBadgeMark id={node.author.look?.badge} size={14} />
            {node.is_ai && <span className="sticker rounded bg-roast px-1 text-[10px] text-white">ROAST</span>}
            <span className="text-muted">·</span>
            <TimeAgo iso={node.created_at} className="text-muted" />
            {!node.deleted && (
              <span className="ml-auto opacity-70 group-hover:opacity-100">
                <Menu
                  trigger={<MoreHorizontal size={16} />}
                  items={[
                    { label: "Report", icon: <Flag size={14} />, onSelect: () => setReporting(true), hidden: node.author.id === me.id },
                    { label: "Delete", icon: <Trash2 size={14} />, onSelect: remove, hidden: !canDelete, danger: true },
                  ]}
                />
              </span>
            )}
          </div>
          {node.deleted ? (
            <p className="text-sm italic text-muted">[deleted — the evidence is gone]</p>
          ) : (
            <RichText text={node.body} className="whitespace-pre-wrap break-words text-[15px] leading-snug" />
          )}
          {!node.deleted && (
            <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted">
              <motion.button whileTap={{ scale: 1.3 }} onClick={like} className={clsx("flex items-center gap-1", liked && "text-heart")} aria-pressed={liked}>
                <Heart size={14} className={liked ? "fill-heart" : undefined} /> {likes || ""}
              </motion.button>
              {depth < 4 && (
                <button onClick={() => setReplying((r) => !r)} className="flex items-center gap-1 hover:text-ink">
                  <Reply size={14} /> Reply
                </button>
              )}
            </div>
          )}
          <AnimatePresence>
            {replying && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 overflow-hidden">
                <CommentBox
                  postId={postId}
                  parentId={node.id}
                  autoFocus
                  placeholder={`Reply to ${node.author.display_name}...`}
                  onDone={() => {
                    setReplying(false);
                    refresh();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {node.children.map((c) => (
        <CommentItem key={c.id} node={c} depth={depth + 1} postId={postId} refresh={refresh} />
      ))}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="comment" targetId={node.id} />
    </motion.div>
  );
}

export function CommentThread({ postId }: { postId: string }) {
  const { toast, toastError } = useApp();
  const { data, mutate } = useRpc<Comment[]>("get_comments", { p_post_id: postId });
  const tree = useMemo(() => buildTree(data ?? []), [data]);
  const [summoning, setSummoning] = useState(false);

  async function summon() {
    setSummoning(true);
    try {
      await ai("roast_post", { post_id: postId });
      toast("The Menace has entered the comments.", "chaos", "🤖");
      mutate();
    } catch (err) {
      toastError(err);
    } finally {
      setSummoning(false);
    }
  }

  return (
    <section className="card p-4" aria-label="Comments">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Comments {data ? `(${data.filter((c) => !c.deleted).length})` : ""}</h2>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={summon}
          disabled={summoning}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-hot to-volt px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {summoning ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
          {summoning ? "Cooking..." : "Summon Menace"}
        </motion.button>
      </div>
      <CommentBox postId={postId} onDone={() => mutate()} />
      <div className="mt-2 divide-y divide-transparent">
        {data && data.length === 0 && <Empty emoji="🦗" text={EMPTY_LINES.comments} />}
        {tree.map((n) => (
          <CommentItem key={n.id} node={n} depth={0} postId={postId} refresh={() => mutate()} />
        ))}
      </div>
    </section>
  );
}
