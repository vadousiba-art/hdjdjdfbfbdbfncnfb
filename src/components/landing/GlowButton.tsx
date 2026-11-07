"use client";

import Link from "next/link";
import { motion } from "motion/react";
import clsx from "clsx";
import { sfx } from "./sfx";

export const APK_URL = "/download/yoru.apk";
export const APK_META = "v2.4.0 · 877 KB · Android 7+";

// Call-to-action button with a slowly spinning gradient border.
export function GlowButton({ href, label, sub, icon, ghost, download }: { href: string; label: string; sub?: string; icon: React.ReactNode; ghost?: boolean; download?: boolean }) {
  const inner = (
    <motion.span
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      onMouseEnter={() => sfx.tick(ghost ? 1 : 4)}
      onClick={() => (download ? sfx.levelUp() : sfx.click())}
      className="group relative block rounded-2xl p-[1.5px]"
    >
      <span className="absolute inset-0 overflow-hidden rounded-2xl opacity-80 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
        <span className="absolute left-1/2 top-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(var(--brand),transparent_30%,var(--brand-2)_50%,transparent_70%,var(--brand))] [animation:yoru-rotate_4s_linear_infinite]" />
      </span>
      <span
        className={clsx(
          "relative flex items-center gap-3 rounded-[15px] px-6 py-3.5 text-left",
          ghost ? "bg-card/95 text-ink" : "bg-brand text-white shadow-[0_10px_40px_-10px_var(--brand)]",
        )}
      >
        {icon}
        <span>
          <span className="block font-semibold leading-tight">{label}</span>
          {sub && <span className={clsx("block text-xs", ghost ? "text-muted" : "text-white/75")}>{sub}</span>}
        </span>
      </span>
    </motion.span>
  );
  return download ? (
    <a href={href} download="YORU.apk" className="block">
      {inner}
    </a>
  ) : (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
