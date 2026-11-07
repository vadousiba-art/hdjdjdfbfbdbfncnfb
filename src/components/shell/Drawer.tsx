"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LogOut, Search, X } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Logo } from "@/components/ui/Logo";
import { post } from "@/lib/client/api";
import { AppDownload } from "@/components/auth/AppDownload";
import { useShell } from "./AppShell";
import { useNavItems } from "./navItems";
import { useI18n } from "@/components/providers/I18nProvider";
import { useOpenGates } from "@/lib/client/gates";
import { WHATS_NEW_EVENT } from "@/lib/releases";
import { LevelChip } from "@/components/yoru/Progression";
import { PALETTE_EVENT } from "@/lib/progress";
import { forgetPushDevice } from "@/lib/client/push";

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const items = useNavItems();
  const { t, locale } = useI18n();
  const { available } = useOpenGates();
  const rtl = locale === "ar";

  useEffect(() => {
    onClose();
    // close when navigating
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const logout = async () => {
    await forgetPushDevice().catch(() => {});
    await post("/api/auth/logout").catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: rtl ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: rtl ? "100%" : "-100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-y-0 start-0 flex w-[84%] max-w-[330px] flex-col overflow-y-auto border-e border-line bg-bg-2 p-5"
            aria-label="Menu"
          >
            <div className="mb-5 flex items-center justify-between">
              <Logo width={130} />
              <button onClick={onClose} className="rounded-full p-2 hover:bg-card-2" aria-label="Close menu">
                <X size={22} />
              </button>
            </div>
            <Link href={`/u/${me.username}`} className="card mb-4 flex items-center gap-3 p-3">
              <Avatar src={me.avatar_url} name={me.display_name} size={48} />
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {me.display_name} {me.badge}
                </div>
                <div className="truncate text-sm text-muted"><bdi>@{me.username}</bdi></div>
              </div>
              {me.level ? <LevelChip level={me.level} className="ms-auto" /> : null}
            </Link>
            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.dispatchEvent(new Event(PALETTE_EVENT)), 220);
              }}
              className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-muted transition-colors duration-150 hover:text-ink"
            >
              <Search size={18} /> Quick jump…
            </button>
            <nav className="flex flex-col gap-0.5">
              {items.filter((i) => i.group === "more" || i.href === "/explore" || i.href === "/atlas" || i.href === "/notifications").map(({ href, label, icon: Icon, badge }) => (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] font-medium text-ink-2 transition-colors duration-150 hover:bg-card-2",
                    pathname === href && "bg-card text-brand",
                  )}
                >
                  <Icon size={22} />
                  {label}
                  {badge ? (
                    <span className="ms-auto rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                  ) : null}
                </Link>
              ))}
            </nav>
            <div className="my-5 h-px bg-line" />
            {available && (
              <div className="mb-4 flex flex-wrap gap-2 text-sm">
                <Link href="/pro" className="rounded-full border border-line px-3 py-1.5 text-ink-2 hover:border-brand hover:text-ink">
                  {t("nav.pro")}
                </Link>
                <Link href="/trust" className="rounded-full border border-line px-3 py-1.5 text-ink-2 hover:border-brand hover:text-ink">
                  {t("nav.trust")}
                </Link>
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => window.dispatchEvent(new Event(WHATS_NEW_EVENT)), 220);
                  }}
                  className="rounded-full border border-line px-3 py-1.5 text-ink-2 hover:border-brand hover:text-ink"
                >
                  {t("nav.whatsNew")}
                </button>
              </div>
            )}
            <AppDownload className="mb-3" />
            <button
              onClick={logout}
              className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-brand hover:bg-card-2"
            >
              <LogOut size={20} /> {t("settings.logout")}
            </button>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
