"use client";

import { useState } from "react";
import { motion } from "motion/react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { ChaosLoader } from "@/components/ui/bits";
import { useRpc } from "@/lib/client/hooks";
import type { MoonMine, MoonStatus } from "@/lib/types";
import { MOON_PHASES, MoonGlyph, phaseName } from "./MoonGlyph";

// Moonrise on a post (docs/MOONRISE.md): the public badge on posts that
// reached Full or Blood Moon, the author's own chip and its climb, and the
// line that says a post is in its first test.

const pct = (x: number | null | undefined) => (x == null ? "–" : `${Math.round(x * 100)}%`);

/** Public: 🌕 Full Moon / 🔴 Blood Moon, next to the post's time. */
export function MoonBadge({ phase }: { phase: 3 | 4 }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={clsx("inline-flex shrink-0 items-center gap-1 font-semibold", phase === 4 ? "text-[#ff4d63]" : "text-ink-2")}
      title={phase === 4 ? "Blood Moon: trending across YORU" : "Full Moon: a hit with its fandom"}
    >
      <MoonGlyph phase={phase} size={14} glow />
      {phase === 4 ? "Blood Moon" : "Full Moon"}
    </motion.span>
  );
}

/** The author's own post: where it is in its climb. Opens the details. */
export function MoonChip({ postId, mine }: { postId: string; mine: MoonMine }) {
  const [open, setOpen] = useState(false);
  const live = mine.state !== "done";
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line/80 px-1.5 py-px text-[11.5px] font-semibold text-ink-2 transition hover:border-brand/60 hover:text-ink"
        aria-label={`Moonrise: ${phaseName(mine.phase)}. See how your post is doing.`}
      >
        <span className="relative inline-flex">
          <MoonGlyph phase={mine.phase} size={13} glow={mine.phase >= 3} />
          {live && (
            <motion.span
              className="absolute inset-0 rounded-full border border-brand/70"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
              aria-hidden
            />
          )}
        </span>
        {phaseName(mine.phase)}
      </button>
      <MoonSheet postId={postId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** For You: this post is in a test, and you're one of the first people it's shown to. */
export function MoonLaneLine({ why }: { why: string }) {
  const m = /^(\S+) ([^:]+): (.*)$/.exec(why);
  const phase = m?.[2] ?? "New Moon";
  const rest = (m?.[3] ?? why).replace(/^new post/, "New post");
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-2 flex min-w-0 items-center gap-1.5 whitespace-nowrap ps-1 text-[12.5px] font-medium text-muted"
      title={`${phase}: ${rest}. It's shown to a few people who like this kind of thing first; if they love it, it goes to more.`}
    >
      <MoonGlyph phase={phase} size={14} />
      <span className="shrink-0 text-ink-2">{phase}</span>
      <span aria-hidden>·</span>
      <span className="min-w-0 truncate">{rest}</span>
      <span aria-hidden>·</span>
      <span className="shrink-0 font-semibold text-brand-2">You&apos;re early</span>
    </motion.div>
  );
}

function stateLine(s: MoonStatus) {
  if (s.state === "done") {
    if (s.phase === 4) return "It made it to the top: trending across YORU.";
    if (s.ended === "exhausted") return `Everyone it could be tested on has seen it, so it stays at ${s.name}. That never counts against it.`;
    return `Its climb is over. It reached ${s.name}, and it keeps a place in For You that matches.`;
  }
  if (s.resumes_at) {
    const at = new Date(s.resumes_at);
    return `Second Night: one more New Moon with new people, from ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  }
  if (s.state === "waiting") return "Waiting for a few more people to see it before it's decided.";
  return s.phase === 3 ? "Being shown to everyone in its fandom now." : "Being shown to new people now.";
}

/** The details: an animated track of the five phases, the numbers, and the history. */
export function MoonSheet({ postId, open, onClose }: { postId: string; open: boolean; onClose: () => void }) {
  const { data: s, error } = useRpc<MoonStatus | null>(open ? "get_moon_status" : null, { p_post: postId }, { refreshInterval: open ? 20_000 : 0 });
  const reached = s?.phase ?? 0;
  return (
    <Modal open={open} onClose={onClose} title="Moonrise">
      {!s && !error && <ChaosLoader />}
      {error && <p className="py-6 text-center text-sm text-muted">Couldn&apos;t load this post&apos;s climb. Try again in a moment.</p>}
      {s === null && <p className="py-6 text-center text-sm text-muted">This post isn&apos;t in Moonrise.</p>}
      {s && (
        <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
          {/* the track */}
          <div className="relative px-1 pt-2">
            <div className="absolute inset-x-6 top-[30px] h-[2px] rounded-full bg-line" aria-hidden />
            <motion.div
              className={clsx("absolute start-6 top-[30px] h-[2px] origin-left rounded-full", s.phase === 4 ? "bg-[#ff3d55]" : "bg-ink-2")}
              style={{ width: "calc(100% - 3rem)" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: reached / 4 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              aria-hidden
            />
            <ol className="relative flex justify-between">
              {MOON_PHASES.map((name, i) => {
                const current = i === s.phase;
                const done = i < s.phase;
                return (
                  <motion.li
                    key={name}
                    className="flex w-12 flex-col items-center gap-1.5 text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * i, type: "spring", stiffness: 380, damping: 26 }}
                  >
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card">
                      {current && s.state !== "done" && (
                        <motion.span
                          className={clsx("absolute inset-0 rounded-full border-2", i === 4 ? "border-[#ff3d55]" : "border-brand")}
                          animate={{ scale: [1, 1.18, 1], opacity: [0.9, 0.35, 0.9] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                          aria-hidden
                        />
                      )}
                      <motion.span animate={current ? { scale: [0.7, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
                        <MoonGlyph phase={i} size={current ? 34 : 26} glow={current && i >= 3} dim={!current && !done} />
                      </motion.span>
                    </span>
                    <span className={clsx("text-[11px] leading-tight", current ? "font-bold text-ink" : "text-muted")}>{name}</span>
                  </motion.li>
                );
              })}
            </ol>
          </div>

          <div>
            <p className="flex items-center gap-1.5 text-[15px] font-semibold">
              <MoonGlyph phase={s.phase} size={18} glow={s.phase >= 3} /> {s.name}
              {s.round === 2 && s.phase === 0 && <span className="ms-1.5 text-[12px] font-medium text-muted">· Second Night</span>}
            </p>
            <p className="mt-0.5 text-[13.5px] text-ink-2">{stateLine(s)}</p>
          </div>

          {s.phase <= 3 && s.state !== "done" && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Shown to" value={`${s.shown}`} sub={`of ${s.target} people`} />
              <Stat label="Loved it" value={pct(s.rate)} sub={`${s.loved} ${s.loved === 1 ? "person" : "people"}`} />
              <Stat
                label="Score"
                value={s.shown > 0 ? pct(s.score) : "–"}
                sub={s.bar != null ? `needs ${pct(s.bar)}` : ""}
                hot={s.loved > 0 && s.bar != null && s.score >= s.bar}
              />
            </div>
          )}
          {s.phase <= 3 && s.state !== "done" && (
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (s.shown / Math.max(1, s.target)) * 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          )}

          <p className="text-[12.5px] leading-relaxed text-muted">
            Every post is shown to strangers who like that kind of thing. People you follow, chat or interact with aren&apos;t in the test, so
            friends can&apos;t push it up. The score counts each post as if 20 more people had seen it and 10% of them loved it, so small numbers stay
            fair. Pro, badges and levels change nothing.
          </p>

          {s.history.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">So far</p>
              <ul className="space-y-1.5">
                {s.history.map((h) => (
                  <li key={`${h.phase}-${h.round}`} className="flex items-center gap-2 text-[13px]">
                    <MoonGlyph phase={h.phase} size={16} />
                    <span className="min-w-0 flex-1 truncate">
                      {h.name}
                      {h.round === 2 ? " (Second Night)" : ""}: {h.loved} of {h.shown} loved it
                    </span>
                    <span className={clsx("shrink-0 text-[12px] font-semibold", h.result === "up" ? "text-brand" : "text-muted")}>
                      {h.result === "up" ? "moved up" : h.result === "retry" ? "one more try" : "stayed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, sub, hot }: { label: string; value: string; sub: string; hot?: boolean }) {
  return (
    <div className="rounded-xl border border-line/80 bg-card-2 px-3 py-2">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className={clsx("text-[18px] font-bold tabular-nums", hot && "text-brand")}>{value}</p>
      <p className="truncate text-[11px] text-muted">{sub}</p>
    </div>
  );
}
