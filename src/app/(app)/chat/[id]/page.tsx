"use client";

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bot, Copy, Flag, ImageIcon, Loader2, LogOut, MoreHorizontal, Reply, Send, ShieldCheck, SmilePlus, Trash2, UserPlus, Users, X } from "lucide-react";
import { OFFICIAL_ID } from "@/lib/nightwatch";
import clsx from "clsx";
import { useSWRConfig } from "swr";
import { byFn, useRpc } from "@/lib/client/hooks";
import { ai, mediaSrc, rpc, uploadFile } from "@/lib/client/api";
import { useTyping } from "@/lib/client/typing";
import { useApp } from "@/components/providers/AppProvider";
import { useLive } from "@/components/providers/LiveProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { item, type ChatP } from "@/lib/pro/catalog";
import { useMyPro, useTryOn } from "@/lib/client/pro";
import { chatBackground } from "@/components/pro/ItemPreview";
import { ChaosLoader, Empty, NameLink, timeAgo } from "@/components/ui/bits";
import { RichText } from "@/components/ui/RichText";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { ReportDialog } from "@/components/feed/ReportDialog";
import { EMPTY_LINES } from "@/lib/jokes";
import type { ChannelDetail, Message, ProfileLite } from "@/lib/types";
import { AtlasAssist } from "@/components/atlas/AtlasAssist";

const QUICK = ["💀", "😭", "🔥", "🫡", "🤡", "❤️", "W", "L"];

function Bubble({
  m,
  mine,
  showHeader,
  onReply,
  onChanged,
}: {
  m: Message;
  mine: boolean;
  showHeader: boolean;
  onReply: (m: Message) => void;
  onChanged: () => void;
}) {
  const { me } = useShell();
  const { toastError, toast } = useApp();
  const [quick, setQuick] = useState(false);
  // the quick-reaction bar opens above the bubble unless that would put it under the sticky chat header
  const [quickBelow, setQuickBelow] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [reporting, setReporting] = useState(false);

  function openQuick(open: boolean) {
    if (open) {
      const top = bubbleRef.current?.getBoundingClientRect().top ?? Infinity;
      const header = document.querySelector("[data-chat-header]")?.getBoundingClientRect().bottom ?? 0;
      setQuickBelow(top - header < 56);
    }
    setQuick(open);
  }

  async function react(emoji: string) {
    setQuick(false);
    try {
      await rpc("toggle_message_reaction", { p_message_id: m.id, p_emoji: emoji });
      onChanged();
    } catch (err) {
      toastError(err);
    }
  }

  async function remove() {
    if (!confirm("Unsend this message?")) return;
    try {
      await rpc("delete_message", { p_id: m.id });
      onChanged();
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={clsx("group flex gap-2", mine ? "flex-row-reverse" : "flex-row", showHeader ? "mt-3" : "mt-0.5", quick && "relative z-30")}
    >
      <div className="w-8 shrink-0">
        {!mine && showHeader && (
          <Link href={`/u/${m.author.username}`}>
            <Avatar src={m.author.avatar_url} name={m.author.display_name} size={32} />
          </Link>
        )}
      </div>
      <div className={clsx("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
        {showHeader && !mine && (
          <div className="mb-0.5 flex items-center gap-1.5 px-1 text-xs">
            <NameLink username={m.author.username} className="font-bold">
              {m.author.display_name}
            </NameLink>
            {m.is_ai && <span className="sticker rounded bg-roast px-1 text-[10px] text-white">AI</span>}
            <span className="text-muted">{timeAgo(m.created_at)}</span>
          </div>
        )}
        <div className="relative" ref={bubbleRef}>
          <div
            className={clsx(
              "rounded-3xl px-3.5 py-2 text-[15px] leading-snug",
              m.deleted && "italic text-muted",
              !m.deleted && mine && "chat-me rounded-br-lg bg-brand text-white",
              !m.deleted && !mine && !m.is_ai && "chat-them rounded-bl-lg bg-card-2 text-ink",
              !m.deleted && m.is_ai && "rounded-bl-lg border border-roast/50 bg-gradient-to-br from-roast/20 to-volt/20 text-ink",
              m.deleted && "border border-dashed border-line",
            )}
            onDoubleClick={() => {
              if (m.deleted) return;
              window.getSelection()?.removeAllRanges(); // a double-tap heart shouldn't also highlight the word
              react("❤️");
            }}
          >
            {m.reply_to && !m.deleted && (
              <div className={clsx("mb-1.5 rounded-xl border-l-2 px-2 py-1 text-xs", mine ? "border-white/70 bg-white/15" : "border-brand bg-black/10")}>
                <b>{m.reply_to.author}</b>
                <div className="line-clamp-2 opacity-80">{m.reply_to.body || "[deleted]"}</div>
              </div>
            )}
            {m.deleted ? (
              "message unsent 👻"
            ) : (
              <>
                {m.media_url &&
                  (m.media_type === "video" ? (
                    <video src={mediaSrc(m.media_url)} controls playsInline className="mb-1 max-h-72 rounded-2xl" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaSrc(m.media_url)} alt="" className="mb-1 max-h-72 rounded-2xl" loading="lazy" />
                  ))}
                {m.body && <RichText text={m.body} className="whitespace-pre-wrap break-words" />}
              </>
            )}
          </div>
          {!m.deleted && (
            <div
              className={clsx(
                "absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex",
                mine ? "right-full mr-1" : "left-full ml-1",
              )}
            >
              <button onClick={() => openQuick(!quick)} className="rounded-full p-1 text-muted hover:bg-card-2" aria-label="React">
                <SmilePlus size={16} />
              </button>
              <button onClick={() => onReply(m)} className="rounded-full p-1 text-muted hover:bg-card-2" aria-label="Reply">
                <Reply size={16} />
              </button>
            </div>
          )}
          <AnimatePresence>
            {quick && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: quickBelow ? -6 : 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className={clsx(
                  "absolute z-20 flex gap-0.5 rounded-full border border-line bg-card p-1 shadow-xl",
                  quickBelow ? "top-full mt-2" : "-top-11",
                  mine ? "right-0" : "left-0",
                )}
              >
                {QUICK.map((e) => (
                  <motion.button key={e} whileHover={{ scale: 1.35, y: -4 }} onClick={() => react(e)} className="rounded-full px-1.5 text-lg font-bold">
                    {e}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {m.reactions.length > 0 && (
          // tucked under the bubble's edge and drawn above it (the bubble is positioned, so the
          // row needs its own stacking order); solid fills so it reads over any bubble or theme
          <div className={clsx("relative z-10 -mt-1.5 flex flex-wrap gap-1 px-2", mine ? "justify-end" : "justify-start")}>
            {m.reactions.map((r) => (
              <motion.button
                key={r.emoji}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                onClick={() => react(r.emoji)}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", you reacted" : ""}`}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full border bg-card px-1.5 py-0.5 text-xs font-bold leading-none shadow-sm",
                  r.mine ? "border-brand text-brand" : "border-line text-ink",
                )}
              >
                <span className="text-[13px] leading-none">{r.emoji}</span>
                {r.count > 1 ? <span className="tabular-nums">{r.count}</span> : null}
              </motion.button>
            ))}
          </div>
        )}
      </div>
      {!m.deleted && (
        <div className="self-center opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
          <Menu
            trigger={<MoreHorizontal size={16} />}
            align={mine ? "right" : "left"}
            items={[
              { label: "Reply", icon: <Reply size={14} />, onSelect: () => onReply(m) },
              { label: "React", icon: <SmilePlus size={14} />, onSelect: () => openQuick(true) },
              {
                label: "Copy text",
                icon: <Copy size={14} />,
                onSelect: async () => {
                  await navigator.clipboard?.writeText(m.body).catch(() => null);
                  toast("Copied.", "success", "📋");
                },
              },
              { label: "Report", icon: <Flag size={14} />, onSelect: () => setReporting(true), hidden: mine },
              { label: "Unsend", icon: <Trash2 size={14} />, onSelect: remove, hidden: !(mine || me.role !== "member"), danger: true },
            ]}
          />
        </div>
      )}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="message" targetId={m.id} />
    </motion.div>
  );
}

function MembersDialog({ channel, open, onClose, onChanged }: { channel: ChannelDetail; open: boolean; onClose: () => void; onChanged: () => void }) {
  const { toastError, toast } = useApp();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: everyone } = useRpc<ProfileLite[]>(open ? "get_members" : null);
  const [adding, setAdding] = useState(false);
  const memberIds = new Set(channel.members.map((m) => m.id));

  async function add(id: string) {
    try {
      await rpc("add_channel_members", { p_channel_id: channel.id, p_member_ids: [id] });
      toast("Added to the chat.", "success", "➕");
      onChanged();
    } catch (err) {
      toastError(err);
    }
  }

  async function leave() {
    if (!confirm("Leave this chat?")) return;
    try {
      await rpc("leave_channel", { p_channel_id: channel.id });
      mutate(byFn("get_channels", "get_me"));
      router.replace("/chat");
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${channel.members.length} members`}>
      <div className="max-h-72 space-y-0.5 overflow-y-auto">
        {channel.members.map((m) => (
          <Link key={m.id} href={`/u/${m.username}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-card-2">
            <Avatar src={m.avatar_url} name={m.display_name} size={36} online={m.online} />
            <span className="text-sm font-bold">{m.display_name}</span>
            <span className="text-xs text-muted">@{m.username}</span>
          </Link>
        ))}
      </div>
      {channel.kind === "group" && channel.is_private && (
        <div className="mt-3">
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-2 text-sm font-bold text-brand">
            <UserPlus size={16} /> Add people
          </button>
          {adding && (
            <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {(everyone ?? [])
                .filter((p) => !p.is_bot && !memberIds.has(p.id))
                .map((p) => (
                  <button key={p.id} onClick={() => add(p.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-card-2">
                    <Avatar src={p.avatar_url} name={p.display_name} size={30} />
                    <span className="text-sm font-semibold">{p.display_name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      {channel.kind === "group" && (
        <button onClick={leave} className="mt-4 flex items-center gap-2 text-sm font-bold text-hot">
          <LogOut size={16} /> Leave chat
        </button>
      )}
    </Modal>
  );
}

export default function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useShell();
  // Chat Personalization: only changes how this conversation looks to you.
  const { data: pro } = useMyPro();
  const tryingChat = useTryOn().chat;
  const chatItem = item<ChatP>(tryingChat !== undefined ? tryingChat : pro?.equips.chat?.active ? pro.equips.chat.item : null);
  const chatThemeProps = chatItem?.cat === "chat"
    ? {
        "data-chat-theme": chatItem.id,
        style: {
          background: chatBackground(chatItem.p),
          "--chat-me": chatItem.p.me, "--chat-me-ink": chatItem.p.meInk, "--chat-them": chatItem.p.them, "--chat-them-ink": chatItem.p.themInk,
        } as React.CSSProperties,
      }
    : null;
  const { toastError, toast, supabase } = useApp();
  const router = useRouter();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: channel, error, mutate: mutateChannel } = useRpc<ChannelDetail>("get_channel", { p_id: id });
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [hasOlder, setHasOlder] = useState(true);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<Message | null>(null);
  const [media, setMedia] = useState<{ path: string; kind: "image" | "video" | "gif"; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const { typing, ping } = useTyping(id, me);

  const markRead = useCallback(() => {
    rpc("mark_channel_read", { p_channel_id: id })
      .then(() => mutateAll(byFn("get_me", "get_channels")))
      .catch(() => {});
  }, [id, mutateAll]);

  const loadLatest = useCallback(async () => {
    const list = await rpc<Message[]>("get_messages", { p_channel_id: id, p_limit: 50 });
    setMessages((prev) => {
      if (!prev) {
        setHasOlder(list.length === 50);
        return list;
      }
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of list) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, [id]);

  // Join public groups automatically, then load.
  useEffect(() => {
    if (!channel) return;
    (async () => {
      try {
        if (!channel.is_member) {
          await rpc("join_channel", { p_channel_id: id });
          mutateChannel();
        }
        await loadLatest();
        markRead();
      } catch (err) {
        toastError(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel?.id, channel?.is_member]);

  useLive(async (e) => {
    if (e.type !== "message" || (e.channel_id !== id && e.channel_id !== "*")) return;
    if (e.channel_id === "*" && !messages?.some((m) => m.id === e.id)) return;
    if (e.op === "INSERT") {
      stick.current = window.innerHeight + window.scrollY > document.body.scrollHeight - 300;
      await loadLatest();
      if (document.visibilityState === "visible") markRead();
    } else {
      try {
        const updated = await rpc<Message>("get_message", { p_id: e.id });
        setMessages((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev);
      } catch {
        /* gone or no access */
      }
    }
  });

  useLayoutEffect(() => {
    // Scroll the whole page so the sticky composer sits below the last message.
    if (stick.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [messages?.length]);

  async function loadOlder() {
    if (!messages?.length) return;
    const older = await rpc<Message[]>("get_messages", { p_channel_id: id, p_before: messages[0].created_at, p_limit: 50 });
    setHasOlder(older.length === 50);
    stick.current = false;
    setMessages((prev) => [...older, ...(prev ?? [])]);
  }

  async function attach(file: File) {
    setUploading(true);
    const preview = URL.createObjectURL(file);
    try {
      setMedia({ ...(await uploadFile(file, supabase)), preview });
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const body = text.trim();
    if ((!body && !media) || sending) return;
    setSending(true);
    try {
      const sent = await rpc<Message>("send_message", {
        p_channel_id: id,
        p_body: body,
        p_media_url: media?.path ?? null,
        p_media_type: media?.kind ?? null,
        p_reply_to: reply?.id ?? null,
      });
      stick.current = true;
      setMessages((prev) => (prev?.some((m) => m.id === sent.id) ? prev : [...(prev ?? []), sent]));
      setText("");
      setReply(null);
      setMedia(null);
      if (/^\/menace\b/i.test(body)) {
        toast("Summoning the Menace into the chat...", "chaos", "🤖");
        ai("chat_command", { channel_id: id, message_id: sent.id })
          .then(() => loadLatest())
          .catch(toastError);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const onChangeText = (v: string) => {
    setText(v.slice(0, 2000));
    ping();
    const m = v.match(/@([A-Za-z0-9_]{0,20})$/);
    setMentionQ(m ? m[1].toLowerCase() : null);
  };

  if (error) return <Empty emoji="🚪" text={error.message} />;
  if (!channel) return <ChaosLoader />;

  const title = channel.kind === "dm" ? (channel.members.find((m) => m.id !== me.id)?.display_name ?? "DM") : channel.name;
  const dmUser = channel.kind === "dm" ? channel.members.find((m) => m.id !== me.id) : null;
  const official = dmUser?.id === OFFICIAL_ID;
  const mentionOptions =
    mentionQ !== null
      ? channel.members.filter((m) => m.id !== me.id && m.username.toLowerCase().startsWith(mentionQ)).slice(0, 5)
      : [];

  return (
    <div>
      <div data-chat-header className="sticky top-[var(--header-h,76px)] z-20 -mx-3 mb-2 flex items-center gap-3 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
        <button onClick={() => router.push("/chat")} className="rounded-full p-1.5 hover:bg-card-2" aria-label="Back to chats">
          <ArrowLeft size={20} />
        </button>
        {dmUser ? (
          <Avatar src={dmUser.avatar_url} name={dmUser.display_name} size={38} online={dmUser.online} />
        ) : (
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-card-2 text-xl">{channel.emoji}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{title}</div>
          <div className="truncate text-xs text-muted">
            {typing.length ? (
              <span className="font-semibold text-online">
                {typing.slice(0, 2).join(", ")} {typing.length === 1 ? "is" : "are"} typing
                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                  ...
                </motion.span>
              </span>
            ) : official ? (
              "Official notices from the YORU team"
            ) : dmUser ? (
              dmUser.online ? "online" : "offline (touching grass)"
            ) : (
              `${channel.members.length} members · ${channel.description || "no description, pure vibes"}`
            )}
          </div>
        </div>
        <button onClick={() => setMembersOpen(true)} className="rounded-full p-2 hover:bg-card-2" aria-label="Members">
          <Users size={20} />
        </button>
      </div>

      {hasOlder && messages && messages.length > 0 && (
        <button onClick={loadOlder} className="mx-auto mb-2 block rounded-full border border-line px-3 py-1 text-xs font-bold text-muted hover:text-ink">
          Load older messages
        </button>
      )}
      {!messages && <ChaosLoader />}
      {messages && messages.length === 0 && <Empty emoji="🪦" text={EMPTY_LINES.messages} />}
      <div {...chatThemeProps} className={chatThemeProps ? "-mx-3 rounded-3xl px-3 py-2 sm:mx-0" : undefined}>
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const showHeader =
            !prev || prev.author.id !== m.author.id || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;
          return (
            <Bubble
              key={m.id}
              m={m}
              mine={m.author.id === me.id}
              showHeader={showHeader}
              onReply={(msg) => {
                setReply(msg);
                inputRef.current?.focus();
              }}
              onChanged={loadLatest}
            />
          );
        })}
      </div>

      {official ? (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-4 lg:bottom-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-2xl">
            <ShieldCheck size={22} className="shrink-0 text-[#5865f2]" />
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">This channel only sends notices, so replies aren&apos;t read. To appeal a decision, use Account Standing.</p>
            <Link href="/standing" className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg">
              Account Standing
            </Link>
          </div>
        </div>
      ) : (
      <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-4 lg:bottom-4">
        <div>
          <AnimatePresence>
            {mentionOptions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-1 overflow-hidden rounded-2xl border border-line bg-card shadow-xl">
                {mentionOptions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setText((t) => t.replace(/@([A-Za-z0-9_]{0,20})$/, `@${p.username} `));
                      setMentionQ(null);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-card-2"
                  >
                    <Avatar src={p.avatar_url} name={p.display_name} size={24} /> <b>{p.display_name}</b>
                    <span className="text-muted">@{p.username}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-3xl border border-line bg-card p-2 shadow-2xl">
            {reply && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl bg-card-2 px-3 py-1.5 text-xs">
                <Reply size={14} className="text-brand" />
                <span className="min-w-0 flex-1 truncate">
                  Replying to <b>{reply.author.display_name}</b>: {reply.body}
                </span>
                <button onClick={() => setReply(null)} aria-label="Cancel reply">
                  <X size={14} />
                </button>
              </div>
            )}
            {media && (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {media.kind === "video" ? <video src={media.preview} className="h-20 rounded-xl" /> : <img src={media.preview} alt="" className="h-20 rounded-xl" />}
                <button onClick={() => setMedia(null)} className="absolute -right-2 -top-2 rounded-full bg-black p-1 text-white" aria-label="Remove attachment">
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-full p-2 text-brand hover:bg-card-2"
                aria-label="Attach media"
              >
                {uploading ? <Loader2 size={22} className="animate-spin" /> : <ImageIcon size={22} />}
              </button>
              <button
                onClick={() => {
                  setText((t) => (t.startsWith("/menace") ? t : `/menace ${t}`));
                  inputRef.current?.focus();
                }}
                className="rounded-full p-2 text-roast hover:bg-card-2"
                aria-label="Ask the AI Menace in chat"
                title="/menace — only this message is sent to the AI"
              >
                <Bot size={22} />
              </button>
              <AtlasAssist value={text} onUse={(t) => onChangeText(t.slice(0, 2000))} tasks={["message", "rewrite"]} className="self-center" />
              <textarea
                ref={inputRef}
                value={text}
                rows={1}
                onChange={(e) => onChangeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${channel.kind === "dm" ? title : `#${channel.name}`}`}
                className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted"
                aria-label="Message"
                dir="auto"
              />
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={send}
                disabled={(!text.trim() && !media) || sending}
                className="rounded-full bg-brand p-2.5 text-white disabled:opacity-40"
                aria-label="Send"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </motion.button>
            </div>
            {text.startsWith("/menace") && (
              <p className="px-2 pt-1 text-[11px] text-muted">🤖 Only this message is sent to the AI Menace — never the rest of the chat.</p>
            )}
          </div>
        </div>
      </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void attach(f);
          e.target.value = "";
        }}
      />
      <MembersDialog channel={channel} open={membersOpen} onClose={() => setMembersOpen(false)} onChanged={() => mutateChannel()} />
    </div>
  );
}
