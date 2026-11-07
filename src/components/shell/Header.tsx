"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Heart, Menu as MenuIcon, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { Logo } from "@/components/ui/Logo";
import { NIGHT_MODE_EVENT } from "@/lib/progress";
import { useMe } from "@/lib/client/hooks";
import { useShell } from "./AppShell";

// Phone top bar: wordmark on the left; search, activity and menu on the right.
// Laptops use the side rail instead, so this hides from lg up.
export function Header() {
  const { openDrawer } = useShell();
  const { data: me } = useMe();
  const unread = me?.unread_notifications ?? 0;
  // Publish the header's height so sticky sub-headers (chat) sit right below it.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Five quick taps on the logo unlock 夜 mode.
  const taps = useRef<number[]>([]);
  const onLogoTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 1800), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      window.dispatchEvent(new Event(NIGHT_MODE_EVENT));
    }
  };

  const btn = "relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-card-2";
  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-line/60 bg-bg px-3 lg:hidden">
      <div className="flex h-[54px] items-center gap-1">
        <Link href="/" onClick={onLogoTap} aria-label="YORU home" className="ms-1 flex items-center">
          <Logo width={96} />
        </Link>
        <div className="ms-auto flex items-center">
          <Link href="/explore" className={btn} aria-label="Search">
            <Search size={23} strokeWidth={2} />
          </Link>
          <Link href="/notifications" className={btn} aria-label={`Activity${unread ? `, ${unread} unread` : ""}`}>
            <Heart size={24} strokeWidth={2} />
            {unread > 0 && (
              <motion.span
                key={unread}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.18 }}
                className="absolute end-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-bg"
              >
                {unread > 99 ? "99+" : unread}
              </motion.span>
            )}
          </Link>
          <button onClick={openDrawer} className={btn} aria-label="Menu">
            <MenuIcon size={24} strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
