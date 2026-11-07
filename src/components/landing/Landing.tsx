"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ChevronDown, Download, Globe, Play, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { Logo, TAGLINE, TAGLINE_JP } from "@/components/ui/Logo";
import { LegalLinks } from "@/components/public/LegalLinks";
import { CATEGORIES } from "@/lib/jokes";
import { NightSky } from "./NightSky";
import { Showcase, Promo } from "./Showcase";
import { Demos } from "./Demos";
import { FeatureGrid, Install, Faq } from "./Sections";
import { ProUniverse } from "./ProUniverse";
import { setSoundEnabled, sfx, soundEnabled, unlockAudio } from "./sfx";
import { APK_META, APK_URL, GlowButton } from "./GlowButton";
import { WelcomePlayer } from "@/components/welcome/WelcomePlayer";
import { WELCOME } from "@/lib/welcome/config";

const WORDS = ["anime", "manga", "Vocaloid", "gaming", "art", "music", "late nights"];

// The YORU website: animated hero, live demos, install guide and FAQ.
export function Landing({ qrSvg, deleted }: { qrSvg: string; deleted: boolean }) {
  const [inApp, setInApp] = useState(false);
  const [sound, setSound] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [intro, setIntro] = useState(false);
  const { scrollY } = useScroll();
  const kanjiY = useTransform(scrollY, [0, 800], [0, 220]);
  const heroFade = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setInApp(/IsraelTokntAndroid/.test(navigator.userAgent));
    setSound(soundEnabled());
    /* eslint-enable react-hooks/set-state-in-effect */
    const onScroll = () => setScrolled(window.scrollY > 24);
    // First gesture unlocks audio and rings the gong.
    const unlock = () => {
      if (unlockAudio()) sfx.gong();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) {
      unlockAudio();
      sfx.sparkle();
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-bg text-ink">
      <nav
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
          scrolled ? "border-b border-line/60 bg-bg/80 backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <a href="#top" aria-label="YORU" onClick={() => sfx.whoosh()}>
            <Logo width={104} />
          </a>
          <div className="ml-6 hidden items-center gap-1 text-sm text-ink-2 md:flex">
            {[
              ["#features", "Features"],
              ["#pro", "Pro"],
              ["#try", "Try it"],
              ["#install", "Get the app"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} onMouseEnter={() => sfx.tick(2)} className="rounded-full px-3 py-1.5 transition-colors duration-150 hover:text-ink">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggleSound}
              className="rounded-full p-2 text-ink-2 transition-colors duration-150 hover:bg-card-2 hover:text-ink"
              aria-label={sound ? "Mute sound effects" : "Turn on sound effects"}
              aria-pressed={sound}
            >
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <Link href="/login" onClick={() => sfx.click()} className="hidden rounded-full px-3 py-1.5 text-sm text-ink-2 hover:text-ink sm:block">
              Log in
            </Link>
            <Link href="/join" onClick={() => sfx.click()} className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-2">
              Join free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header id="top" className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-24 text-center">
        <NightSky />
        <motion.div
          style={{ y: kanjiY }}
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center pt-[22vh] text-[min(78vw,640px)] font-bold leading-none text-white/[0.025] blur-[2px]"
          aria-hidden
        >
          <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            夜
          </motion.span>
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" aria-hidden />

        <motion.div style={{ opacity: heroFade }} className="relative z-10 flex flex-col items-center">
          {deleted && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 rounded-full border border-line bg-card/80 px-4 py-2 text-sm text-ink-2" role="status">
              Your account has been deleted. Thanks for the nights. 夜は、まだ終わらない。
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, scale: 0.86, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-10 rounded-full bg-brand/25 blur-3xl" aria-hidden />
            <Logo width={340} className="relative max-w-[82vw]" />
          </motion.div>

          <p className="tagline mt-6 flex flex-wrap justify-center text-[13px] text-ink sm:text-sm" aria-label={TAGLINE}>
            {TAGLINE.split("").map((ch, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.025, duration: 0.3 }} aria-hidden>
                {ch === " " ? " " : ch}
              </motion.span>
            ))}
          </p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.6 }} className="mt-2 text-muted">
            {TAGLINE_JP}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6, ease: "easeOut" }}
            className="mt-10 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
          >
            Find your people
            <br />
            for <RotatingWord />
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="mt-5 max-w-xl text-base text-ink-2 sm:text-lg"
          >
            A free social network for anime, manga, music, Vocaloid, gaming and art fans. Post, chat, level up every night, and make your profile move. No ads. No tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.5 }}
            className="mt-9 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center"
          >
            <GlowButton href="/join" icon={<Globe size={20} />} label="Open YORU on the web" sub="Free · no download needed" />
            {inApp ? (
              <GlowButton href="/" icon={<Download size={20} />} label="Open YORU" sub="You're in the app" ghost />
            ) : (
              <GlowButton href={APK_URL} download icon={<Download size={20} />} label="Download for Android" sub={APK_META} ghost />
            )}
          </motion.div>
          {WELCOME && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
              onClick={() => setIntro(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-4 py-2 text-sm font-semibold text-ink hover:border-brand/60"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                <Play size={12} fill="currentColor" />
              </span>
              Watch the {Math.round(WELCOME.full.duration)}-second intro
            </motion.button>
          )}
          {intro && WELCOME && <WelcomePlayer config={WELCOME} cut="full" enterHref="/join" onClose={() => setIntro(false)} />}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} className="mt-4 text-sm text-muted">
            Already a member?{" "}
            <Link href="/login" className="text-brand-2 underline-offset-4 hover:underline">
              Log in
            </Link>
          </motion.p>
        </motion.div>

        <motion.a
          href="#features"
          aria-label="Scroll to features"
          className="absolute bottom-6 z-10 text-muted"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={28} />
        </motion.a>
      </header>

      <Marquee />
      <Promo />
      <FeatureGrid />
      <ProUniverse />
      <Showcase />
      <Demos />
      <Install qrSvg={qrSvg} inApp={inApp} />
      <Faq />
      <FinalCta inApp={inApp} />

      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center">
          <Logo width={96} />
          <LegalLinks />
          <p className="text-xs text-muted">© {new Date().getFullYear()} YORU · Made for the night. 夜は、まだ終わらない。</p>
        </div>
      </footer>
    </div>
  );
}

function RotatingWord() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-flex h-[1.15em] min-w-[5ch] justify-center overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={WORDS[i]}
          initial={{ y: "100%", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent"
        >
          {WORDS[i]}.
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Marquee() {
  const row = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];
  return (
    <section aria-label="Categories" className="relative space-y-3 overflow-hidden border-y border-line/60 py-6 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      {[0, 1].map((dir) => (
        <div key={dir} className={clsx("flex w-max gap-3", dir ? "[animation:marquee-rev_40s_linear_infinite]" : "[animation:marquee_40s_linear_infinite]")}>
          {[...row, ...row].map((c, i) => (
            <span key={`${c.tag}-${i}`} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-card/70 px-4 py-2 text-sm">
              <span className="font-semibold">{c.label}</span>
              <span className="text-brand-2">{c.jp}</span>
            </span>
          ))}
        </div>
      ))}
    </section>
  );
}

function FinalCta({ inApp }: { inApp: boolean }) {
  return (
    <section className="px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        onViewportEnter={() => sfx.whoosh()}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-brand/40 bg-card px-6 py-16 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--brand)_35%,transparent),transparent_65%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-6 -top-16 select-none text-[220px] font-bold leading-none text-white/[0.04]" aria-hidden>
          夜
        </div>
        <div className="relative">
          <p className="tagline text-xs text-brand-2">The night is young</p>
          <h2 className="mt-3 text-3xl font-bold sm:text-5xl">夜は、まだ終わらない。</h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-2">Your next conversation starts here. Join in seconds on the web or grab the Android app.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <GlowButton href="/join" icon={<Globe size={20} />} label="Join YORU free" sub="Takes 30 seconds" />
            {!inApp && <GlowButton href={APK_URL} download icon={<Download size={20} />} label="Get the APK" sub={APK_META} ghost />}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
