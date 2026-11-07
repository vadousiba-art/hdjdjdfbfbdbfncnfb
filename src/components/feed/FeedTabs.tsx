"use client";

import { motion } from "motion/react";
import clsx from "clsx";
import { useT } from "@/components/providers/I18nProvider";

export type FeedTab = "for_you" | "latest" | "interests";

// Home feed switcher, sticky under the top bar.
export function FeedTabs({ value, onChange }: { value: FeedTab; onChange: (t: FeedTab) => void }) {
  const t = useT();
  const tabs: [FeedTab, string][] = [
    ["for_you", t("feed.forYou")],
    ["latest", t("feed.latest")],
    ["interests", t("feed.interests")],
  ];
  return (
    <div className="sticky top-[var(--header-h,0px)] z-20 -mx-3 mt-2 border-b border-line/70 bg-bg px-3 sm:-mx-4 sm:px-4" role="tablist" aria-label="Feed">
      <div className="flex">
        {tabs.map(([key, label]) => {
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(key)}
              className={clsx("relative flex-1 py-3 text-[14.5px] transition-colors duration-150", on ? "font-semibold text-ink" : "text-muted hover:text-ink-2")}
            >
              {label}
              {on && <motion.span layoutId="feed-tab" className="absolute inset-x-[30%] bottom-0 h-[3px] rounded-full bg-ink" transition={{ duration: 0.2 }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
