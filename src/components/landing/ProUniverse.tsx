"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import clsx from "clsx";
import { BarChart3, CalendarClock, Compass, SlidersHorizontal } from "lucide-react";
import { CATALOG, ITEM_BY_ID, banners, nameplates, rings, type BannerP, type NameplateP } from "@/lib/pro/catalog";
import { SETS } from "@/lib/pro/sets";
import { reducedMotion } from "@/lib/client/pro";
import { RingAvatar } from "@/components/pro/ItemPreview";
import { BannerArt } from "@/components/pro/art/Banner";
import { Nameplate } from "@/components/pro/art/Marks";
import { ProfileMock } from "@/components/pro/ui";
import { sfx } from "./sfx";

// The public showcase for the YORU Pro Universe. Everything on screen is the
// real renderer members use in the app. Pro is paid by Interac e-Transfer.

const LOOKS = SETS.filter((s) => s.look);
const RING_PICKS = ["ring.crimson_eclipse", "ring.neon_circuit", "ring.holographic_prism", "ring.digital_rain", "ring.obsidian_crown", "ring.infinite_night"];
const BANNER_PICKS = ["banner.neon_tokyo", "banner.crimson_rain", "banner.infinite_nightfall"];
const PLATE_PICKS = ["nameplate.afterdark_legend", "nameplate.neon_drifter", "nameplate.voidwalker", "nameplate.yoru_eternal"];
const FREE = CATALOG.filter((i) => i.unlock === "free").length;
const AVATAR = "/seed/avatar-you.png";

const TOOLS = [
  { icon: CalendarClock, title: "Draft Studio & planner", body: "Private drafts with templates, a calendar, and posts that go out at the time you choose." },
  { icon: BarChart3, title: "Your own analytics", body: "Reach, reactions, comments and profile visits, from real activity only. Nobody sees who visited." },
  { icon: SlidersHorizontal, title: "Feed controls", body: "Saved filters for your feed: tags, media, new members, muted words. They never change anyone's reach." },
  { icon: Compass, title: "Interest hubs", body: "Discovery pages for anime, manga, Vocaloid, gaming, art and more, built from real posts and members." },
];

export function ProUniverse() {
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const t = setInterval(() => setN((x) => (x + 1) % LOOKS.length), 3600);
    return () => clearInterval(t);
  }, [auto]);
  const set = LOOKS[n];

  return (
    <section id="pro" className="relative overflow-hidden px-4 py-24" aria-labelledby="pro-title">
      <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
        <BannerArt p={ITEM_BY_ID[set.look!.banner].p as BannerP} className="h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg via-bg/85 to-bg" aria-hidden />
      <div className="relative mx-auto max-w-6xl">
        <p className="tagline text-center text-xs text-brand-2">YORU Pro · 夜の宇宙</p>
        <h2 id="pro-title" className="mt-3 text-center text-3xl font-bold sm:text-5xl">
          Your profile. Your universe.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-ink-2">
          400 animated cosmetics in 20 systems: rings that move around your avatar, living banners, nameplates, badges, themes, effects and
          more. {FREE} of them are free for every member, and some you earn just by taking part.
        </p>

        <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            onViewportEnter={() => sfx.whoosh()}
            className="mx-auto w-full max-w-sm"
          >
            <ProfileMock look={set.look!} name="You" username="you" avatar={AVATAR} />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black tracking-wide">{set.name.toUpperCase()} <span className="font-normal text-muted">{set.jp}</span></div>
                <div className="truncate text-xs text-muted">{set.tagline}</div>
              </div>
              <div className="flex shrink-0 gap-1" role="tablist" aria-label="Signature looks">
                {LOOKS.map((s, i) => (
                  <button key={s.id} type="button" role="tab" aria-selected={i === n} aria-label={s.name}
                    onClick={() => { setAuto(false); setN(i); sfx.tick(i); }}
                    className={clsx("h-2 rounded-full transition-all", i === n ? "w-5 bg-ink" : "w-2 bg-ink/30")} />
                ))}
              </div>
            </div>
          </motion.div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3">
              {RING_PICKS.map((id) => {
                const r = rings.find((x) => x.id === id)!;
                return (
                  <div key={id} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card/80 p-3">
                    <RingAvatar ring={r.p} size={58} name="You" src={AVATAR} />
                    <span className="text-center text-[11px] font-semibold text-ink-2">{r.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BANNER_PICKS.map((id) => {
                const b = banners.find((x) => x.id === id)!;
                return (
                  <BannerArt key={id} p={b.p as BannerP} className="h-20 rounded-2xl border border-line">
                    <span className="absolute bottom-1.5 start-2 rounded bg-black/50 px-1.5 text-[10px] font-bold text-white">{b.name}</span>
                  </BannerArt>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-[#0b0b0b] p-3">
              {PLATE_PICKS.map((id) => <Nameplate key={id} p={nameplates.find((x) => x.id === id)!.p as NameplateP} />)}
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="rounded-3xl border border-line bg-card/90 p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/15 text-brand"><t.icon size={20} /></span>
              <h3 className="mt-3 font-semibold">{t.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{t.body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-line bg-card/90 p-5 text-center">
          <p className="text-sm text-ink-2">
            <b className="text-ink">YORU Pro is open.</b> It&apos;s CA$5.99 for a month, paid by Interac e-Transfer from your own bank, and nothing
            renews by itself.{" "}
            Posting, chatting, privacy tools and the free cosmetics stay free for everyone, and Pro never changes who sees your posts.
          </p>
          <Link href="/join" onClick={() => sfx.click()} className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-2">
            Join free and try them on
          </Link>
        </div>
      </div>
    </section>
  );
}
