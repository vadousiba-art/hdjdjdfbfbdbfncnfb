"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Bot, CalendarClock, Download, Flame, Globe, Languages, MessagesSquare, Palette, Plus, ShieldCheck, Smartphone, Sparkles, Wand2 } from "lucide-react";
import clsx from "clsx";
import { FAQ } from "@/lib/faq";
import { APK_META, APK_URL, GlowButton } from "./GlowButton";
import { sfx } from "./sfx";

const FEATURES = [
  { icon: Sparkles, title: "Feed & stories", jp: "投稿", body: "Text, photos, GIFs, video and polls. 24-hour stories, reactions, ||spoilers|| and Tonight's picks." },
  { icon: MessagesSquare, title: "Group chats & DMs", jp: "話", body: "Realtime chats with typing dots, replies, reactions and media. Make a group for every fandom." },
  { icon: Flame, title: "Levels & night streaks", jp: "昇", body: "Earn XP and check in every night. Climb from 新人 Newcomer to 夜の王 Night Sovereign." },
  { icon: Palette, title: "Make it yours", jp: "色", body: "Slide to recolor the whole app. Ambient stars, sakura, rain or fireflies behind your feed." },
  { icon: Wand2, title: "Animated profiles", jp: "動", body: "Rings that move around your avatar, living banners, nameplates, badges and themes. 115 free for everyone." },
  { icon: CalendarClock, title: "Drafts & scheduled posts", jp: "予", body: "Keep private drafts, start from templates and schedule posts for later. Your own analytics, from real activity only." },
  { icon: Languages, title: "16 languages & Discover", jp: "縁", body: "Use YORU in 16 languages, add your interests and find people who share them, anywhere in the world." },
  { icon: Bot, title: "The AI Menace", jp: "笑", body: "An opt-in AI comedian that roasts posts, rates takes and crashes the group chat." },
  { icon: ShieldCheck, title: "Safe by design", jp: "守", body: "Members-only content, report and block everywhere, real moderation. No ads, no tracking." },
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-4 py-24" aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl">
        <p className="tagline text-center text-xs text-brand-2">Features</p>
        <h2 id="features-title" className="mt-3 text-center text-3xl font-bold sm:text-5xl">
          Built for fans who stay up late.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6 }}
              onMouseEnter={() => sfx.tick(i)}
              className="group relative overflow-hidden rounded-3xl border border-line bg-card p-6 transition-colors duration-200 hover:border-brand/60"
            >
              <span className="pointer-events-none absolute -right-3 -top-6 select-none text-[110px] font-bold leading-none text-white/[0.035] transition-colors duration-300 group-hover:text-brand/10" aria-hidden>
                {f.jp}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <f.icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Download", body: "Tap Download for Android and open the file when it finishes." },
  { n: "2", title: "Allow & install", body: "If Android asks, allow your browser to install apps for this download, then tap Install." },
  { n: "3", title: "Join the night", body: "Open YORU, create a free account in seconds, and find your people." },
];

export function Install({ qrSvg, inApp }: { qrSvg: string; inApp: boolean }) {
  return (
    <section id="install" className="px-4 py-24" aria-labelledby="install-title">
      <div className="mx-auto max-w-6xl">
        <p className="tagline text-center text-xs text-brand-2">Get the app</p>
        <h2 id="install-title" className="mt-3 text-center text-3xl font-bold sm:text-5xl">
          On your phone in a minute.
        </h2>
        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-4 rounded-3xl border border-line bg-card p-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white shadow-[0_8px_30px_-8px_var(--brand)]">{s.n}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-2">{s.body}</p>
                </div>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex flex-col gap-3 pt-3 sm:flex-row"
            >
              {!inApp && <GlowButton href={APK_URL} download icon={<Download size={20} />} label="Download for Android" sub={APK_META} />}
              <GlowButton href="/join" icon={<Globe size={20} />} label="Use it on the web" sub="Any browser, no install" ghost />
            </motion.div>
            <p className="pt-2 text-xs text-muted">Only install YORU from this website or our official store listings. Your account works everywhere.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="hidden rounded-3xl border border-line bg-card p-6 text-center lg:block">
              <h3 className="font-semibold">On a computer?</h3>
              <p className="mt-1 text-sm text-ink-2">Scan with your Android phone to download.</p>
              <div
                className="mx-auto mt-4 w-48 rounded-2xl bg-white p-3 shadow-[0_0_50px_-10px_var(--brand)]"
                role="img"
                aria-label="QR code linking to the YORU Android download"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
            <div className="rounded-3xl border border-line bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <Smartphone size={18} className="text-brand" /> iPhone
              </h3>
              <p className="mt-1 text-sm text-ink-2">Open this site in Safari, tap Share, then Add to Home Screen. YORU opens full screen like an app.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="px-4 py-24" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl">
        <p className="tagline text-center text-xs text-brand-2">よくある質問</p>
        <h2 id="faq-title" className="mt-3 text-center text-3xl font-bold sm:text-5xl">
          Questions
        </h2>
        <div className="mt-10 space-y-2">
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={f.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.2) }}
                className={clsx("overflow-hidden rounded-2xl border bg-card transition-colors duration-200", isOpen ? "border-brand/50" : "border-line")}
              >
                <button
                  onClick={() => {
                    setOpen(isOpen ? null : i);
                    sfx.tick(i);
                  }}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
                >
                  {f.q}
                  <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 text-brand">
                    <Plus size={20} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          More help on the{" "}
          <Link href="/support" className="text-brand-2 underline-offset-4 hover:underline">
            Support page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
