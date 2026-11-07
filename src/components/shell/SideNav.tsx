"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Menu as MenuIcon, Plus } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Logo, Mark } from "@/components/ui/Logo";
import { post } from "@/lib/client/api";
import { useT } from "@/components/providers/I18nProvider";
import { useShell } from "./AppShell";
import { useNavItems } from "./navItems";
import { forgetPushDevice } from "@/lib/client/push";

// Desktop rail: icons on laptops, icons with labels on wide screens. Everything
// beyond the main six lives in the More menu.
export function SideNav() {
  const { me, openComposer } = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const items = useNavItems();
  // The More menu remembers the page it was opened on, so navigating closes it.
  const [moreOn, setMoreOn] = useState<string | null>(null);
  const more = moreOn === pathname;
  const setMore = (v: boolean | ((x: boolean) => boolean)) => setMoreOn((typeof v === "function" ? v(more) : v) ? pathname : null);
  const moreRef = useRef<HTMLDivElement>(null);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const main = items.filter((i) => i.group === "main");
  const extra = items.filter((i) => i.group === "more");

  useEffect(() => {
    if (!more) return;
    const onDown = (e: MouseEvent) => !moreRef.current?.contains(e.target as Node) && setMoreOn(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOn(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [more]);

  const row = "group flex items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-150 hover:bg-card-2";

  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col py-5 lg:flex xl:w-[236px]" aria-label="Sidebar">
      <Link href="/" className="mb-6 flex h-10 items-center px-3" aria-label="YORU home">
        <span className="xl:hidden">
          <Mark size={30} />
        </span>
        <span className="hidden xl:block">
          <Logo width={112} />
        </span>
      </Link>
      <nav className="flex flex-col gap-1">
        {main.map(({ href, label, icon: Icon, badge }) => {
          const on = active(href);
          const isProfile = href === `/u/${me.username}`;
          return (
            <Link key={href} href={href} title={label} aria-current={on ? "page" : undefined} className={clsx(row, on ? "font-semibold text-ink" : "text-ink-2")}>
              <span className="relative flex w-7 justify-center">
                {isProfile ? (
                  <span className={clsx("rounded-full p-[1.5px]", on ? "bg-ink" : "bg-transparent")}>
                    <Avatar src={me.avatar_url} name={me.display_name} size={24} />
                  </span>
                ) : (
                  <Icon size={25} strokeWidth={on ? 2.4 : 1.9} />
                )}
                {badge ? (
                  <span className="absolute -end-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
              <span className="hidden xl:inline">{label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => openComposer()} title={t("nav.create")} className={clsx(row, "text-ink-2")}>
          <span className="flex w-7 justify-center">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-bg">
              <Plus size={18} strokeWidth={2.8} />
            </span>
          </span>
          <span className="hidden xl:inline">{t("nav.create")}</span>
        </button>
      </nav>

      <div className="relative mt-auto" ref={moreRef}>
        <AnimatePresence>
          {more && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.14 }}
              className="absolute bottom-full start-0 z-50 mb-2 w-[260px] overflow-hidden rounded-2xl border border-line bg-bg-2 p-1.5 shadow-2xl"
              role="menu"
            >
              {extra.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} role="menuitem" className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] hover:bg-card-2", active(href) ? "font-semibold text-ink" : "text-ink-2")}>
                  <Icon size={20} strokeWidth={1.9} /> {label}
                </Link>
              ))}
              <div className="my-1 h-px bg-line" />
              <button
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-ink-2 hover:bg-card-2"
                onClick={async () => {
                  await forgetPushDevice().catch(() => {});
                  await post("/api/auth/logout").catch(() => null);
                  router.replace("/login");
                  router.refresh();
                }}
              >
                <LogOut size={20} strokeWidth={1.9} /> Log out @{me.username}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-haspopup="menu" title={t("nav.more")} className={clsx(row, "w-full", more ? "font-semibold text-ink" : "text-ink-2")}>
          <span className="flex w-7 justify-center">
            <MenuIcon size={25} strokeWidth={more ? 2.4 : 1.9} />
          </span>
          <span className="hidden xl:inline">{t("nav.more")}</span>
        </button>
      </div>
    </aside>
  );
}
