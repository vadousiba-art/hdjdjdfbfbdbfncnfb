"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Clapperboard, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useShell } from "@/components/shell/AppShell";
import { useI18n } from "@/components/providers/I18nProvider";
import { WhatsNew } from "@/components/yoru/WhatsNew";
import { rpc } from "@/lib/client/api";
import { CURRENT_RELEASE, RELEASE_SEEN_KEY, WHATS_NEW_EVENT } from "@/lib/releases";
import { WELCOME, chooseWelcome, welcomeSeenKey, type WelcomeCut, type WelcomeState } from "@/lib/welcome/config";
import { WelcomePlayer } from "./WelcomePlayer";

const CHECKED_KEY = "yoru-welcome-checked";

function storage(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // blocked storage: fall back to the server preference only
  }
}

// Decides when the welcome film appears and owns the "What's new" menu entry.
// - Shows at most once per welcome version, remembered on the profile
//   (migration 0008) and mirrored on the device.
// - Only on a fresh load of the home screen, never mid-session or on route changes.
// - Everything is skippable; nothing here blocks using YORU.
export function WelcomeExperience() {
  const { me } = useShell();
  const { t } = useI18n();
  const pathname = usePathname();
  const [cut, setCut] = useState<WelcomeCut | null>(null);
  const [hub, setHub] = useState(false);
  const [reading, setReading] = useState(false);
  const auto = useRef(false); // this showing was automatic (mark it seen on close)
  const firstPath = useRef(pathname);

  useEffect(() => {
    if (!WELCOME?.autoShow || firstPath.current !== "/") return;
    const version = WELCOME.version;
    const local = storage("local");
    const session = storage("session");
    if (local?.getItem(welcomeSeenKey(me.id)) === version) return;
    if (session?.getItem(CHECKED_KEY) === `${me.id}:${version}`) return;
    session?.setItem(CHECKED_KEY, `${me.id}:${version}`);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    rpc<WelcomeState>("get_welcome_state")
      .catch(() => ({ seen: null, account_age_hours: Number.POSITIVE_INFINITY }) as WelcomeState) // older database: short update
      .then((state) => {
        if (cancelled) return;
        const choice = chooseWelcome(state, version);
        if (!choice) {
          local?.setItem(welcomeSeenKey(me.id), version);
          return;
        }
        timer = setTimeout(() => {
          auto.current = true;
          setCut(choice);
        }, 700);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [me.id]);

  useEffect(() => {
    const open = () => setHub(true);
    window.addEventListener(WHATS_NEW_EVENT, open);
    return () => window.removeEventListener(WHATS_NEW_EVENT, open);
  }, []);

  const markSeen = useCallback(() => {
    if (!WELCOME) return;
    storage("local")?.setItem(welcomeSeenKey(me.id), WELCOME.version);
    storage("local")?.setItem(RELEASE_SEEN_KEY, CURRENT_RELEASE.version);
    rpc("mark_welcome_seen", { p_version: WELCOME.version }).catch(() => {});
  }, [me.id]);

  const onClose = useCallback(
    () => {
      if (auto.current) markSeen();
      auto.current = false;
      setCut(null);
    },
    [markSeen],
  );

  return (
    <>
      {WELCOME && cut && (
        <WelcomePlayer
          config={WELCOME}
          cut={cut}
          onClose={onClose}
          onReadInstead={() => {
            onClose();
            setReading(true);
          }}
        />
      )}
      <Modal open={hub} onClose={() => setHub(false)} title={t("welcome.hub")}>
        <p className="-mt-1 mb-3 text-sm text-muted">{t("welcome.hubSub")}</p>
        <div className="space-y-2">
          {WELCOME && (
            <>
              <HubButton
                icon={<Clapperboard size={20} />}
                title={t("welcome.watchFull")}
                sub={`${t("welcome.full")} · ${Math.round(WELCOME.full.duration)} s`}
                onClick={() => {
                  setHub(false);
                  setCut("full");
                }}
              />
              <HubButton
                icon={<Sparkles size={20} />}
                title={t("welcome.watchShort")}
                sub={`${t("welcome.short")} · ${Math.round(WELCOME.short.duration)} s`}
                onClick={() => {
                  setHub(false);
                  setCut("short");
                }}
              />
            </>
          )}
          <HubButton
            icon={<BookOpen size={20} />}
            title={t("welcome.readInstead")}
            sub={t("wn.title")}
            onClick={() => {
              setHub(false);
              setReading(true);
            }}
          />
        </div>
      </Modal>
      <WhatsNew open={reading} onClose={() => setReading(false)} />
    </>
  );
}

function HubButton({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-start hover:border-brand/60 hover:bg-card-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </button>
  );
}
