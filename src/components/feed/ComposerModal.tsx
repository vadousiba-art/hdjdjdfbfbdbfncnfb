"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, Dices, EyeOff, Film, ImageIcon, Link2, Loader2, Plus, Target, Type, X } from "lucide-react";
import clsx from "clsx";
import { useSWRConfig } from "swr";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { rpc, uploadFile } from "@/lib/client/api";
import { byFn, refreshFeeds, useSite } from "@/lib/client/hooks";
import { CATEGORIES, pickLine, SUCCESS_TOASTS, todaysChallenge } from "@/lib/jokes";
import { burst } from "@/components/ui/EmojiBurst";
import { playSound } from "@/lib/client/sounds";
import { AtlasAssist } from "@/components/atlas/AtlasAssist";

export type ComposerTab = "text" | "media" | "poll" | "link";

const ABSURD_CAPTIONS = [
  "Watching this at 3am. No regrets.",
  "Hot take incoming.",
  "This episode changed me.",
  "Rate my latest pull.",
  "Currently on loop.",
  "Villain arc begins tonight.",
  "Filler arc of my life, but the OST slaps.",
  "Power scaling debate, go.",
]

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

export function ComposerModal({
  open,
  onClose,
  initialTab,
  initialFile,
  initialText,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: ComposerTab;
  initialFile?: File | null;
  initialText?: string;
}) {
  const { me } = useShell();
  const { toast, toastError, supabase } = useApp();
  const { mutate } = useSWRConfig();
  const [tab, setTab] = useState<ComposerTab>("text");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ path: string; kind: "image" | "video" | "gif"; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { data: site } = useSite();
  const prompt = site?.nightly_prompt || todaysChallenge();

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTab(initialTab ?? "text");
    if (initialText) setBody((b) => b || initialText);
    if (initialFile) void attach(initialFile);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setBody("");
    setMedia(null);
    setOptions(["", ""]);
    setLink("");
    setTab("text");
  }

  async function attach(file: File) {
    setTab("media");
    setUploading(true);
    const preview = URL.createObjectURL(file);
    try {
      const up = await uploadFile(file, supabase);
      setMedia({ ...up, preview });
    } catch (err) {
      URL.revokeObjectURL(preview);
      toastError(err);
    } finally {
      setUploading(false);
    }
  }

  const pollReady = tab !== "poll" || options.filter((o) => o.trim()).length >= 2;
  const canPost =
    !busy &&
    !uploading &&
    pollReady &&
    (body.trim().length > 0 || (tab === "media" && media !== null)) &&
    (tab !== "link" || /^https?:\/\/\S+\.\S+/.test(link.trim()));

  async function submit() {
    if (!canPost) return;
    setBusy(true);
    try {
      await rpc("create_post", {
        p_body: body.trim(),
        p_media_url: tab === "media" ? (media?.path ?? null) : null,
        p_media_type: tab === "media" ? (media?.kind ?? null) : null,
        p_link_url: tab === "link" ? link.trim() : null,
        p_poll_options: tab === "poll" ? options.map((o) => o.trim()).filter(Boolean) : null,
      });
      burst("🌸", submitRef.current);
      playSound("victory");
      toast(pickLine(SUCCESS_TOASTS.post), "success", "🌸");
      mutate(byFn("get_trending_tags", "get_me", "get_profile", "get_my_progress"));
      refreshFeeds();
      reset();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: ComposerTab; label: string; icon: React.ReactNode }[] = [
    { id: "text", label: "Text", icon: <Type size={16} /> },
    { id: "media", label: "Media", icon: <ImageIcon size={16} /> },
    { id: "poll", label: "Poll", icon: <BarChart3 size={16} /> },
    { id: "link", label: "Link", icon: <Link2 size={16} /> },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Drop a post" wide>
      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition",
              tab === t.id ? "border-brand bg-brand text-white" : "border-line text-ink hover:bg-card-2",
            )}
            aria-pressed={tab === t.id}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <Avatar src={me.avatar_url} name={me.display_name} size={44} ring="brand" />
        <div className="min-w-0 flex-1">
          <textarea
            ref={textRef}
            data-autofocus
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder={tab === "poll" ? "Ask the group a question..." : "What's on your mind?"}
            className="h-28 w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted"
            aria-label="Post text"
            dir="auto"
          />
          <div className="-mt-1 mb-1 flex justify-end">
            <AtlasAssist value={body} onUse={(t) => setBody(t.slice(0, 2000))} tasks={tab === "media" ? ["caption", "post", "rewrite"] : ["post", "rewrite"]} align="end" />
          </div>
          <AnimatePresence mode="wait">
            {tab === "media" && (
              <motion.div key="media" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {media ? (
                  <div className="relative overflow-hidden rounded-xl border border-line">
                    {media.kind === "video" ? (
                      <video src={media.preview} controls className="max-h-72 w-full bg-black" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media.preview} alt="Upload preview" className="max-h-72 w-full object-cover" />
                    )}
                    <button
                      onClick={() => setMedia(null)}
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white"
                      aria-label="Remove media"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-brand hover:text-brand"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <span className="flex gap-2">
                          <ImageIcon /> <Film />
                        </span>
                        <span className="text-sm font-semibold">Photo, GIF or video (max 10MB / 50MB)</span>
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            )}
            {tab === "poll" && (
              <motion.div key="poll" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={o}
                      onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value.slice(0, 80) : x)))}
                      placeholder={`Option ${i + 1}${i === 1 ? " (the wrong answer)" : ""}`}
                      className="flex-1 rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
                      aria-label={`Poll option ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}
                        className="rounded-full p-2 text-muted hover:text-hot"
                        aria-label={`Remove option ${i + 1}`}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <button onClick={() => setOptions((all) => [...all, ""])} className="flex items-center gap-1 text-sm font-bold text-brand">
                    <Plus size={16} /> Add option
                  </button>
                )}
              </motion.div>
            )}
            {tab === "link" && (
              <motion.div key="link" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value.slice(0, 500))}
                  placeholder="https://evidence.example.com"
                  inputMode="url"
                  className="w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
                  aria-label="Link URL"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void attach(f);
          e.target.value = "";
        }}
      />

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto" aria-label="Categories">
        {CATEGORIES.map((c) => {
          const tag = `#${c.tag}`;
          const on = new RegExp(`(^|\\s)${tag}(?=$|\\s)`, "i").test(body);
          return (
            <button
              key={c.tag}
              onClick={() =>
                setBody((b) => (on ? b.replace(new RegExp(`(^|\\s)${tag}(?=$|\\s)`, "ig"), "").trim() : `${b}${b && !b.endsWith(" ") ? " " : ""}${tag}`).slice(0, 2000))
              }
              aria-pressed={on}
              className={clsx(
                "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors duration-150",
                on ? "border-brand bg-brand/15 text-brand-2" : "border-line text-muted hover:text-ink",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-full p-2 text-brand hover:bg-card-2"
          aria-label="Attach photo or video"
        >
          <ImageIcon size={22} />
        </button>
        <button
          onClick={() => setBody((b) => (b ? `${b} ` : "") + pickLine(ABSURD_CAPTIONS))}
          className="rounded-full p-2 text-volt hover:bg-card-2"
          aria-label="Add a random absurd caption"
          title="Absurd caption generator"
        >
          <Dices size={22} />
        </button>
        <button
          onClick={() => {
            const el = textRef.current;
            const start = el?.selectionStart ?? body.length;
            const end = el?.selectionEnd ?? body.length;
            const picked = body.slice(start, end) || "spoiler";
            setBody((b) => `${b.slice(0, start)}||${picked}||${b.slice(end)}`.slice(0, 2000));
          }}
          className="rounded-full p-2 text-muted hover:bg-card-2 hover:text-ink"
          aria-label="Hide selected text as a spoiler"
          title="Spoiler: ||hidden until tapped||"
        >
          <EyeOff size={22} />
        </button>
        <button
          onClick={() => setBody((b) => (b.includes("#dailychallenge") ? b : `${prompt}\n\n${b}${b ? " " : ""}#dailychallenge`))}
          className="flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-semibold text-brand hover:bg-card-2"
          title={prompt}
        >
          <Target size={18} /> Tonight&apos;s prompt
        </button>
        <span className={clsx("ml-auto text-xs tabular-nums", body.length > 1900 ? "text-hot" : "text-muted")}>{body.length}/2000</span>
        <Button ref={submitRef} onClick={submit} disabled={!canPost} className="px-6">
          {busy ? "Posting..." : "Post"}
        </Button>
      </div>
    </Modal>
  );
}
