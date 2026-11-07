"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { Ellipsis, ImageIcon, SquarePlay } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useShell } from "@/components/shell/AppShell";

// The "What's on your mind?" card at the top of the home feed.
export function InlineComposer() {
  const { me, openComposer } = useShell();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) openComposer({ tab: "media", file });
  };

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line px-3 py-2.5 sm:gap-3 sm:px-4">
      <Avatar src={me.avatar_url} name={me.display_name} size={40} />
      <button
        onClick={() => openComposer({ tab: "text" })}
        className="min-w-0 flex-1 py-2 text-left text-[14.5px] leading-snug text-muted sm:text-[15px] transition-colors duration-150 hover:text-ink-2"
      >
        What&apos;s on your mind?
      </button>
      <span className="h-10 w-px shrink-0 bg-line" aria-hidden />
      <div className="flex shrink-0 items-center">
        <Action label="Image" icon={<ImageIcon size={21} strokeWidth={1.7} />} onClick={() => imageRef.current?.click()} aria="Post an image" />
        <span className="h-8 w-px bg-line" aria-hidden />
        <Action label="Video" icon={<SquarePlay size={21} strokeWidth={1.7} />} onClick={() => videoRef.current?.click()} aria="Post a video" />
        <span className="h-8 w-px bg-line" aria-hidden />
        <Action label="More" icon={<Ellipsis size={21} strokeWidth={1.7} />} onClick={() => openComposer({ tab: "poll" })} aria="More post types (poll, link)" />
      </div>
      <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onFile} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={onFile} />
    </div>
  );
}

function Action({ label, icon, onClick, aria }: { label: string; icon: React.ReactNode; onClick: () => void; aria: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className="flex w-[46px] flex-col items-center gap-1 rounded-xl py-1 text-ink-2 transition-colors duration-150 hover:text-ink sm:w-[70px]"
      aria-label={aria}
    >
      {icon}
      <span className="text-[11px] text-muted">{label}</span>
    </motion.button>
  );
}
