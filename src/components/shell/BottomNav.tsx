"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Clapperboard, House, MessageCircle, Plus } from "lucide-react";
import clsx from "clsx";
import { useMe } from "@/lib/client/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { useShell } from "./AppShell";
import { useT } from "@/components/providers/I18nProvider";

// Phone tab bar: Home · Watch · Create · Inbox · Profile. Icons only, with the
// active tab sitting in a soft pill. On Watch it turns black like the video.
export function BottomNav() {
  const pathname = usePathname();
  const { openComposer } = useShell();
  const t = useT();
  const { data: me } = useMe();
  const dark = pathname.startsWith("/watch");
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const profileHref = me ? `/u/${me.username}` : "/settings";

  const tab = (href: string, label: string, icon: (active: boolean) => React.ReactNode, badge?: number) => {
    const active = isActive(href);
    return (
      <Link
        href={href}
        aria-label={badge ? `${label}, ${badge} unread` : label}
        aria-current={active ? "page" : undefined}
        className="relative flex h-12 flex-1 items-center justify-center"
      >
        <motion.span
          whileTap={{ scale: 0.9 }}
          transition={{ duration: 0.12 }}
          className={clsx(
            "relative flex h-10 w-[58px] items-center justify-center rounded-full transition-colors duration-150",
            active ? (dark ? "bg-white/15 text-white" : "bg-card-2 text-ink") : dark ? "text-white/70" : "text-ink-2",
          )}
        >
          {icon(active)}
          {badge ? (
            <span className="absolute end-2 top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white ring-2 ring-bg-2">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </motion.span>
      </Link>
    );
  };

  return (
    <nav
      className={clsx(
        "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t lg:hidden",
        dark ? "border-white/10 bg-black" : "border-line bg-bg-2/95 backdrop-blur-xl",
      )}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-[640px] items-center px-1.5 py-1">
        {tab("/", t("nav.home"), (a) => <House size={25} strokeWidth={a ? 2.3 : 1.9} fill={a ? "currentColor" : "none"} />)}
        {tab("/watch", t("nav.watch"), (a) => <Clapperboard size={25} strokeWidth={a ? 2.3 : 1.9} />)}
        <div className="flex h-12 flex-1 items-center justify-center">
          <motion.button
            onClick={() => openComposer()}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className={clsx(
              "flex h-9 w-12 items-center justify-center rounded-xl",
              dark ? "bg-white text-black" : "bg-ink text-bg",
            )}
            aria-label={t("nav.create")}
          >
            <Plus size={24} strokeWidth={2.6} />
          </motion.button>
        </div>
        {tab("/chat", t("nav.inbox"), (a) => <MessageCircle size={25} strokeWidth={a ? 2.3 : 1.9} />, me?.unread_messages)}
        {tab(profileHref, t("nav.profile"), (a) => (
          <span className={clsx("rounded-full p-[1.5px]", a ? (dark ? "bg-white" : "bg-ink") : "bg-transparent")}>
            <Avatar src={me?.avatar_url} name={me?.display_name ?? "You"} size={26} />
          </span>
        ))}
      </div>
    </nav>
  );
}
