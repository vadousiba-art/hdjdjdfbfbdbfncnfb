"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Clock, FlaskConical, Moon, Sparkles } from "lucide-react";
import { useIdentity } from "@/lib/client/gates";
import { useI18n } from "@/components/providers/I18nProvider";
import { useShell } from "@/components/shell/AppShell";
import { Gate } from "@/components/yoru/Gate";
import { BY_CATEGORY, CATALOG, ITEM_BY_ID, banners, rings, type BannerP } from "@/lib/pro/catalog";
import { SETS } from "@/lib/pro/sets";
import { CATEGORIES } from "@/lib/pro/types";
import { reducedMotion, tryOn, useMyPro, useTryOn } from "@/lib/client/pro";
import { BannerArt } from "@/components/pro/art/Banner";
import { CAT_LABEL, ProfileMock, useLookWithTryOn } from "@/components/pro/ui";
import { PayPalSubscribe, usePayPalBilling } from "@/components/pro/PayPalSubscribe";
import type { MessageKey } from "@/lib/i18n/messages/en";

const BENEFITS: MessageKey[] = ["pro.b.cosmetics", "pro.b.themes", "pro.b.badge", "pro.b.shield", "pro.b.early"];
const FREE: MessageKey[] = ["pro.f.social", "pro.f.privacy", "pro.f.progress", "pro.f.collections", "pro.f.discover"];
const LOOKS = SETS.filter((s) => s.look);

export default function ProPage() {
  return (
    <Gate>
      <Landing />
    </Gate>
  );
}

function Hero() {
  const { me } = useShell();
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || reducedMotion()) return;
    const t = setInterval(() => setN((x) => (x + 1) % LOOKS.length), 3800);
    return () => clearInterval(t);
  }, [auto]);
  const set = LOOKS[n];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-[#050505] text-white">
      <BannerArt p={ITEM_BY_ID[set.look!.banner].p as BannerP} className="absolute inset-0 opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />
      <div className="relative grid grid-cols-1 gap-6 p-6 sm:grid-cols-[1.1fr_1fr] sm:p-8">
        <div className="flex min-w-0 flex-col justify-end">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-white/70">
            <Moon size={14} className="text-brand" /> YORU Pro
          </div>
          <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
            YOUR PROFILE.
            <br />
            YOUR UNIVERSE.
          </h1>
          <p className="mt-3 max-w-sm text-[15px] text-white/80">
            Four hundred ways to make YORU look like you: rings, banners, nameplates, themes, effects and the tools to go with them. The social part stays free for everyone.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/pro/shop" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-2">
              Explore YORU Pro <ArrowRight size={16} />
            </Link>
            <a href="#try" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10">
              Preview the cosmetics
            </a>
          </div>
        </div>
        <div className="min-w-0">
          <ProfileMock look={set.look!} name={me.display_name} username={me.username} avatar={me.avatar_url} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-wide">{set.name.toUpperCase()} <span className="font-normal text-white/60">{set.jp}</span></div>
              <div className="truncate text-xs text-white/60">{set.tagline}</div>
            </div>
            <div className="flex shrink-0 gap-1" role="tablist" aria-label="Signature looks">
              {LOOKS.map((s, i) => (
                <button key={s.id} type="button" role="tab" aria-selected={i === n} aria-label={s.name}
                  onClick={() => { setAuto(false); setN(i); }}
                  className={clsx("h-2 rounded-full transition-all", i === n ? "w-5 bg-white" : "w-2 bg-white/35")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  const { me } = useShell();
  const [x, setX] = useState(55);
  const look = LOOKS[3].look!;
  return (
    <section className="card p-5">
      <h2 className="text-lg font-black">Before and after</h2>
      <p className="text-sm text-muted">The same profile, with the {LOOKS[3].name} look. Drag to compare.</p>
      <div className="relative mt-3 grid overflow-hidden rounded-2xl">
        <ProfileMock look={{}} name={me.display_name} username={me.username} avatar={me.avatar_url} still className="[grid-area:1/1]" />
        <div className="[grid-area:1/1]" style={{ clipPath: `inset(0 0 0 ${x}%)` }}>
          <ProfileMock look={look} name={me.display_name} username={me.username} avatar={me.avatar_url} still className="h-full" />
        </div>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${x}%` }} />
        <span className="absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">BEFORE</span>
        <span className="absolute end-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">AFTER</span>
      </div>
      <input type="range" min={0} max={100} value={x} onChange={(e) => setX(Number(e.target.value))} className="mt-3 w-full accent-[var(--brand)]" aria-label="Compare before and after" />
    </section>
  );
}

function TryOnLive() {
  const { me } = useShell();
  const look = useLookWithTryOn();
  const t = useTryOn();
  const ringPick = [rings[1], rings[8], rings[9], rings[18], rings[0], rings[2], rings[11], rings[19]];
  const bannerPick = [banners[0], banners[4], banners[2], banners[7], banners[12], banners[19]];
  return (
    <section id="try" className="card scroll-mt-20 p-5">
      <h2 className="text-lg font-black">Try it on yourself</h2>
      <p className="text-sm text-muted">Tap to preview on your own profile. Only you see it, nothing is saved or unlocked.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProfileMock look={look} name={me.display_name} username={me.username} avatar={me.avatar_url} />
        <div className="space-y-3">
          <Picker label="Ring" items={ringPick} active={t.ring} onPick={(id) => tryOn.set("ring", id)} />
          <Picker label="Banner" items={bannerPick} active={t.banner} onPick={(id) => tryOn.set("banner", id)} />
          <div className="flex gap-2">
            <Link href="/pro/shop" className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white">All 400 items</Link>
            <button type="button" onClick={() => tryOn.clear()} className="rounded-full border border-line px-4 py-2 text-sm font-bold">Reset</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Picker({ label, items, active, onPick }: { label: string; items: { id: string; name: string; unlock: string }[]; active?: string | null; onPick: (id: string | null) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button key={i.id} type="button" aria-pressed={active === i.id} onClick={() => onPick(active === i.id ? null : i.id)}
            className={clsx("rounded-full border px-2.5 py-1 text-xs font-semibold", active === i.id ? "border-brand bg-brand/15 text-ink" : "border-line text-ink-2 hover:border-brand")}>
            {i.name}{i.unlock === "free" ? "" : i.unlock === "pro" ? " · Pro" : " · Earn"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const { t, formatDate } = useI18n();
  const { data: id } = useIdentity();
  const { data: mine } = useMyPro();
  const billing = usePayPalBilling();
  const live = Boolean(billing?.enabled);
  const until = id?.pro_until && id.pro_until !== "infinity" ? id.pro_until : null;
  const free = CATALOG.filter((i) => i.unlock === "free").length;
  const earned = CATALOG.filter((i) => i.unlock.startsWith("milestone:")).length;
  const experimental = CATALOG.filter((i) => i.status === "experimental").length;

  return (
    <div className="space-y-4">
      <Hero />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["400", "items"], ["20", "systems"], [String(SETS.length), "collections"], [String(free), "free for everyone"]].map(([n, l]) => (
          <div key={l} className="card px-3 py-3 text-center">
            <div className="text-2xl font-black">{n}</div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{l}</div>
          </div>
        ))}
      </section>

      <BeforeAfter />
      <TryOnLive />

      <section className="card p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-black">Collections</h2>
            <p className="text-sm text-muted">Ten signature looks, each a ring, banner, nameplate, badge and theme made to be worn together.</p>
          </div>
          <Link href="/pro/shop?view=sets" className="shrink-0 text-sm font-bold text-brand">All sets</Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOOKS.map((s) => (
            <Link key={s.id} href={`/pro/shop?set=${s.id}`} className="group overflow-hidden rounded-2xl border border-line">
              <BannerArt p={ITEM_BY_ID[s.look!.banner].p as BannerP} className="h-20" still>
                <span className="absolute bottom-1.5 end-2 text-[11px] font-bold text-white/70">{s.jp}</span>
              </BannerArt>
              <div className="p-2.5">
                <div className="text-sm font-black tracking-wide group-hover:text-brand">{s.name.toUpperCase()}</div>
                <div className="line-clamp-2 text-xs text-muted">{s.tagline}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-black">Twenty systems</h2>
        <p className="text-sm text-muted">Every system has twenty options. Some are free for everyone and some are earned by taking part; the rest come with Pro.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((c) => {
            const items = BY_CATEGORY[c];
            return (
              <Link key={c} href={`/pro/shop?cat=${c}`} className="rounded-xl border border-line p-2.5 hover:border-brand">
                <div className="text-[10px] font-bold text-muted">{String(CAT_LABEL[c].n).padStart(2, "0")}</div>
                <div className="text-sm font-bold leading-tight">{CAT_LABEL[c].name}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {items.filter((i) => i.unlock === "free").length} free · {items.filter((i) => i.unlock.startsWith("milestone")).length} earned
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="membership" className="card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            <h2 className="text-lg font-black">Membership</h2>
            <div className="mt-1 text-2xl font-black">{t("pro.price")}</div>
            <div className="max-w-xs text-xs text-muted">{t(live ? "pro.priceLive" : "pro.priceNote")}</div>
          </div>
          {id?.pro ? (
            <div className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white">
              {until ? t("pro.active", { date: formatDate(until) }) : t("pro.activeForever")}
            </div>
          ) : (
            <PayPalSubscribe
              config={billing}
              fallback={
                <button disabled className="cursor-not-allowed rounded-full border border-line px-4 py-2 text-sm font-bold text-muted" aria-describedby="pro-not-open">
                  {t("pro.unavailable")}
                </button>
              }
            />
          )}
        </div>
        {id?.pro && mine?.membership.source === "paypal" && (
          <p className="mx-5 mb-5 rounded-xl border border-line bg-card-2 p-3 text-sm text-ink-2">{t("pro.manage")}</p>
        )}
        {!id?.pro && !live && billing && (
          <p id="pro-not-open" className="mx-5 mb-5 rounded-xl border border-line bg-card-2 p-3 text-sm text-ink-2">
            {t("pro.notOpen")}
          </p>
        )}
        <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{t("pro.included")}</h3>
            <ul className="space-y-2">
              {BENEFITS.map((k) => (
                <li key={k} className="flex gap-2 text-sm"><Check size={16} className="mt-0.5 shrink-0 text-brand" /> {t(k)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{t("pro.alwaysFree")}</h3>
            <ul className="space-y-2">
              {FREE.map((k) => (
                <li key={k} className="flex gap-2 text-sm text-ink-2"><Check size={16} className="mt-0.5 shrink-0 text-online" /> {t(k)}</li>
              ))}
              <li className="flex gap-2 text-sm text-ink-2"><Check size={16} className="mt-0.5 shrink-0 text-online" /> {free} free catalog items, {earned} you can earn by taking part</li>
            </ul>
          </div>
        </div>
        <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-3">
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted"><Sparkles size={13} /> Available now</h3>
            <p className="text-sm text-ink-2">The full catalog, previews and try-on, equipping, wishlists, Draft Studio, the Post Planner, analytics, insights, feed presets and interest hubs.</p>
          </div>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted"><FlaskConical size={13} /> Experimental</h3>
            <p className="text-sm text-ink-2">{experimental} items, clearly labelled and off until you switch them on in the Preview Lab.</p>
          </div>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted"><Clock size={13} /> {live ? "Billing" : "In development"}</h3>
            <p className="text-sm text-ink-2">
              {live
                ? "Monthly subscription through PayPal. PayPal handles your card or balance; YORU never sees your payment details."
                : "Checkout and billing. Until a payment provider is connected and the price is confirmed, nobody can be charged."}
            </p>
          </div>
        </div>
        <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-muted">{t(live ? "pro.termsLive" : "pro.terms")}</p>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-black">Tools</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ["/pro/studio", "Draft Studio & Planner", "Templates, private drafts, scheduling"],
            ["/pro/analytics", "Analytics & Insights", "Your real numbers, your way"],
            ["/pro/feeds", "Feed controls", "Saved filters for your feed"],
            ["/pro/hubs", "Interest Hubs", "Discovery pages for your interests"],
            ["/pro/lab", "Preview Lab", "Previews and opt-in experiments"],
            ["/pro/hub", "Membership hub", "What you own, wear and want"],
          ].map(([href, name, blurb]) => (
            <Link key={href} href={href} className="rounded-xl border border-line p-3 hover:border-brand">
              <div className="text-sm font-bold">{name}</div>
              <div className="text-xs text-muted">{blurb}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-2 pb-4">
        <Link href="/pro/shop" className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white">Explore YORU Pro</Link>
        <a href="#try" className="rounded-full border border-line px-5 py-2.5 text-sm font-bold">Preview the cosmetics</a>
      </div>
    </div>
  );
}
