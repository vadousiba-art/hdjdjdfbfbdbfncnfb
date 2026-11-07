"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import clsx from "clsx";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  bare?: boolean;
};

// Bottom sheet on phones, centered dialog on larger screens.
export function Modal({ open, onClose, title, children, className, wide, bare }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      target?.focus();
    }, 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={!bare && title ? titleId : undefined}
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.6, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={clsx(
              "relative z-10 max-h-[92dvh] w-full overflow-y-auto outline-none",
              !bare && "rounded-t-3xl border border-line bg-card p-5 pb-8 shadow-2xl sm:rounded-3xl sm:pb-5",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg",
              className,
            )}
          >
            {!bare && <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" aria-hidden />}
            {!bare && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-2 text-muted transition hover:bg-card-2 hover:text-ink"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
