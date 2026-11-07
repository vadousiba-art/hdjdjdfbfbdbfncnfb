"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/components/providers/I18nProvider";
import { CURRENT_RELEASE, RELEASE_SEEN_KEY } from "@/lib/releases";

// "What's new in YORU": the release notes as slides. Opened from the welcome
// experience ("Read what's new"), and the readable alternative to the welcome
// film. Skippable at any point, closes with Escape, never plays sound. Motion
// follows the reduced-motion preference through the app's MotionConfig.
export function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const rel = CURRENT_RELEASE;
  const slide = rel.slides[i];
  const last = i === rel.slides.length - 1;

  const close = useCallback(() => {
    onClose();
    try {
      localStorage.setItem(RELEASE_SEEN_KEY, rel.version);
    } catch {
      /* storage blocked */
    }
  }, [onClose, rel.version]);

  useEffect(() => {
    if (open) setI(0); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, rel.slides.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
      if (e.key === "Tab" && panel.current) {
        // keep focus inside the dialog
        const f = [...panel.current.querySelectorAll<HTMLElement>("a,button")].filter((el) => !el.hasAttribute("disabled"));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, close, rel.slides.length]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="whats-new-title"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-full max-w-[560px] overflow-hidden rounded-t-[22px] border border-line bg-[#070707] text-white shadow-2xl sm:rounded-[22px]"
          >
            {/* manga-panel frame: thin double border with a crimson corner cut */}
            <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[16px] border border-white/10" />
            <div aria-hidden className="pointer-events-none absolute -end-7 -top-7 h-16 w-16 rotate-45 bg-brand" />
            <div aria-hidden className="speedlines pointer-events-none absolute inset-0 opacity-[0.07]" />

            <div className="relative flex items-center justify-between px-6 pt-6">
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.35 }}>
                <Logo width={108} />
              </motion.div>
              <button onClick={close} className="relative z-10 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("common.close")}>
                <X size={20} />
              </button>
            </div>

            <div className="relative px-6 pb-2 pt-5">
              <div className="mb-1 pe-8 text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">
                {t("wn.title")} · {t("wn.version", { version: `${rel.version} “${rel.name}”` })}
              </div>
              <div className="min-h-[248px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    <div className="mt-3 inline-block border-s-2 border-brand ps-2 text-sm font-bold text-brand">{slide.kicker}</div>
                    <h2 id="whats-new-title" className="mt-2 text-[28px] font-black leading-[1.05] tracking-tight sm:text-[32px]">
                      {slide.title}
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/75">{slide.body}</p>
                    {slide.href && slide.cta && (
                      <Link href={slide.href} onClick={close} className="mt-4 inline-block text-sm font-bold text-white underline decoration-brand decoration-2 underline-offset-4">
                        {t(slide.cta)} →
                      </Link>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="relative flex items-center gap-3 px-6 pb-6 pt-3">
              <div className="flex flex-1 gap-1.5" aria-label={`${i + 1} / ${rel.slides.length}`}>
                {rel.slides.map((_, n) => (
                  <button
                    key={n}
                    onClick={() => setI(n)}
                    aria-label={`${n + 1}`}
                    aria-current={n === i ? "step" : undefined}
                    className={clsx("h-1.5 rounded-full transition-all duration-200", n === i ? "w-7 bg-brand" : "w-3 bg-white/25 hover:bg-white/45")}
                  />
                ))}
              </div>
              {!last && (
                <button onClick={close} className="rounded-full px-3 py-2 text-sm font-semibold text-white/60 hover:text-white">
                  {t("wn.skip")}
                </button>
              )}
              {i > 0 && (
                <button onClick={() => setI(i - 1)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">
                  {t("wn.prev")}
                </button>
              )}
              <button
                data-autofocus
                onClick={() => (last ? close() : setI(i + 1))}
                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white hover:bg-brand-2"
              >
                {last ? t("wn.done") : t("wn.next")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
