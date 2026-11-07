"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { useMe } from "@/lib/client/hooks";
import { ApiError } from "@/lib/client/api";
import { LiveProvider } from "@/components/providers/LiveProvider";
import { useApp } from "@/components/providers/AppProvider";
import { ChaosLoader } from "@/components/ui/bits";
import { EmojiBurstLayer } from "@/components/ui/EmojiBurst";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";
import { Drawer } from "./Drawer";
import { SideNav } from "./SideNav";
import { RightRail } from "./RightRail";
import { ComposerModal, type ComposerTab } from "@/components/feed/ComposerModal";
import { StoryComposer } from "@/components/stories/StoryComposer";
import { Ambience } from "@/components/fx/Ambience";
import { Celebrations } from "@/components/fx/Celebrations";
import { CommandPalette } from "@/components/fx/CommandPalette";
import { AccentStyle, AnnouncementBanner } from "@/components/yoru/Progression";
import { WelcomeExperience } from "@/components/welcome/WelcomeExperience";
import { ProRuntime } from "@/components/pro/ProRuntime";
import { LocaleSync } from "@/components/yoru/LocaleSync";
import type { Me } from "@/lib/types";
import { syncPush } from "@/lib/client/push";

type ComposerOpts = { tab?: ComposerTab; file?: File | null; text?: string };
type ShellCtx = {
  me: Me;
  openComposer: (opts?: ComposerOpts) => void;
  openStoryComposer: () => void;
  openDrawer: () => void;
};
const Ctx = createContext<ShellCtx | null>(null);

export function useShell() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShell outside AppShell");
  return v;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, error } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const { config, ambience } = useApp();
  const [composer, setComposer] = useState<ComposerOpts | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, router, pathname]);

  // Push: keep this device linked to whoever is signed in, clear the app badge.
  const signedIn = Boolean(me?.id);
  useEffect(() => {
    if (signedIn) syncPush().catch(() => {});
  }, [signedIn]);

  // Watchtower and the inbox use the extra width instead of the right rail.
  const wide = pathname.startsWith("/admin");
  const openComposer = useCallback((opts?: ComposerOpts) => setComposer(opts ?? {}), []);
  const openStoryComposer = useCallback(() => setStoryOpen(true), []);
  const openDrawer = useCallback(() => setDrawer(true), []);

  if (!me) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        {error && !(error instanceof ApiError && error.status === 401) ? (
          <div className="max-w-sm px-6 text-center">
            
            <p className="font-bold">Can&apos;t connect right now.</p>
            <p className="mt-1 text-sm text-muted">{error instanceof ApiError ? error.message : "Unknown error."}</p>
          </div>
        ) : (
          <ChaosLoader />
        )}
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ me, openComposer, openStoryComposer, openDrawer }}>
      <LiveProvider userId={me.id}>
        <AccentStyle />
        <Ambience mode={ambience} />
        <ProRuntime />
        {config.mode === "demo" && (
          <div className="relative z-30 border-b border-line bg-bg-2 px-3 py-1 text-center text-[11px] font-medium tracking-wide text-muted">
            DEMO MODE · local test login · anyone can log in as anyone ·{" "}
            <a href="/setup" className="text-brand underline">
              connect Supabase
            </a>
          </div>
        )}
        <div className="relative z-[1] mx-auto flex w-full max-w-[1320px] justify-center gap-6 lg:px-4 xl:gap-10">
          <SideNav />
          <div className={clsx("w-full min-w-0", wide ? "max-w-[1040px]" : "max-w-[620px]")}>
            <Header />
            <div className="px-3 sm:px-4">
              <AnnouncementBanner />
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.main
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="px-3 pb-28 sm:px-4 lg:pb-12 lg:pt-5"
              >
                {children}
              </motion.main>
            </AnimatePresence>
          </div>
          {!wide && <RightRail />}
        </div>
        <BottomNav />
        <Drawer open={drawer} onClose={() => setDrawer(false)} />
        <ComposerModal
          open={composer !== null}
          initialTab={composer?.tab}
          initialFile={composer?.file ?? null}
          initialText={composer?.text}
          onClose={() => setComposer(null)}
        />
        <StoryComposer open={storyOpen} onClose={() => setStoryOpen(false)} />
        <EmojiBurstLayer />
        <Celebrations />
        <CommandPalette />
        <WelcomeExperience />
        <LocaleSync />
      </LiveProvider>
    </Ctx.Provider>
  );
}
