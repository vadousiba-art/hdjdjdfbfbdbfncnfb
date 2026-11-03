"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePayPalBilling } from "@/components/pro/PayPalSubscribe";
import Link from "next/link";
import clsx from "clsx";
import { FlaskConical, Lock } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { Button } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { burst } from "@/components/ui/EmojiBurst";
import { rpc } from "@/lib/client/api";
import { useRpc } from "@/lib/client/hooks";
import {
  BY_CATEGORY, ITEM_BY_ID, badges, banners, chats, collectionTemplates, effects, hubs, labs, layouts, milestones, nameplates, reactions, rings, themes,
  type BannerP, type CollectionP, type EffectP, type MilestoneP, type ThemeP,
} from "@/lib/pro/catalog";
import { SETS } from "@/lib/pro/sets";
import type { Item, Slot } from "@/lib/pro/types";
import { ownsItem, saveProSettings, tryOn, useMyPro, useTryOn } from "@/lib/client/pro";
import { applyTheme } from "@/lib/client/pro-fx";
import type { CollectionSummary } from "@/lib/opengates";
import { ItemPreview, RingAvatar } from "@/components/pro/ItemPreview";
import { BannerArt } from "@/components/pro/art/Banner";
import { BadgeArt, CoverArt, MilestoneEmblem, Nameplate } from "@/components/pro/art/Marks";
import { AmbientEffect, TransitionFlash } from "@/components/pro/art/Effects";
import { ExperimentalChip, ProfileMock, useLookWithTryOn } from "@/components/pro/ui";

export default function LabPage() {
  return (
    <Gate>
      <Lab />
    </Gate>
  );
}

function Tool({ i, children }: { i: Item; children: React.ReactNode }) {
  const billing = usePayPalBilling();
  const { data: me } = useMyPro();
  const owned = ownsItem(i, me);
  return (
    <section id={i.id} className="card scroll-mt-24 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-black">{i.name}</h2>
        {i.status === "experimental" && <ExperimentalChip />}
        {!owned && <span className="inline-flex items-center gap-1 rounded-full bg-card-2 px-2 py-0.5 text-[10px] font-bold"><Lock size={10} /> Pro</span>}
      </div>
      <p className="-mt-2 mb-3 text-sm text-muted">{i.desc}</p>
      {owned ? children : <p className="rounded-xl border border-line bg-card-2 p-3 text-sm text-ink-2">This tool is part of YORU Pro. {billing?.enabled ? <a href="/pro#membership" className="font-bold text-brand">Subscribe on the Pro page.</a> : "Purchases aren't open yet."}</p>}
    </section>
  );
}

function Pick<T extends Item>({ items, value, onChange, label }: { items: T[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm">
      {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.unlock === "pro" ? " (Pro)" : i.unlock === "free" ? "" : " (earned)"}</option>)}
    </select>
  );
}

// Theme Forge+: a whole palette from one colour, checked for readable contrast.
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function hsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
function forge(h: number, mode: "dark" | "light"): ThemeP {
  return mode === "dark"
    ? { mode, hue: h, bg: hsl(h, 30, 3), bg2: hsl(h, 28, 5), card: hsl(h, 24, 8), card2: hsl(h, 22, 11), line: hsl(h, 18, 18), ink: hsl(h, 30, 96), ink2: hsl(h, 20, 85), muted: hsl(h, 12, 64) }
    : { mode, hue: h, bg: hsl(h, 30, 96), bg2: hsl(h, 30, 98), card: "#ffffff", card2: hsl(h, 25, 93), line: hsl(h, 18, 84), ink: hsl(h, 40, 6), ink2: hsl(h, 25, 16), muted: hsl(h, 12, 36) };
}

function Lab() {
  const { me: profile } = useShell();
  const { data: me } = useMyPro();
  const { toast, toastError } = useApp();
  const look = useLookWithTryOn();
  const t = useTryOn();
  const { data: cols } = useRpc<CollectionSummary[]>("get_my_collections", { p_post_id: null });
  const [banner, setBanner] = useState(banners[1].id);
  const [chat, setChat] = useState(chats[2].id);
  const [layout, setLayout] = useState(layouts[1].id);
  const [effect, setEffect] = useState(effects[0].id);
  const [transition, setTransition] = useState(0);
  const [transId, setTransId] = useState(effects.find((e) => e.p.kind === "transition")!.id);
  const [cover, setCover] = useState(collectionTemplates[0].id);
  const [bundle, setBundle] = useState<string>(SETS[0].id);
  const [hue, setHue] = useState(200);
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [forging, setForging] = useState(false);
  const [sandbox, setSandbox] = useState<Partial<Record<Slot, string>>>({ ring: rings[0].id, banner: banners[0].id, nameplate: nameplates[0].id, badge: badges[0].id });
  const reactRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const forged = useMemo(() => forge(hue, mode), [hue, mode]);
  const labsOn = me?.settings.labs ?? [];
  const expOn = labsOn.includes("lab.experimental_effects");
  const future = useMemo(() => [rings[16], banners[12], nameplates[6], badges[13]], []);

  useEffect(() => {
    if (forging) applyTheme(forged);
  }, [forging, forged]);
  useEffect(() => () => { if (forging) applyTheme(null); }, [forging]);

  const lab = (id: string) => ITEM_BY_ID[id];
  const transitions = effects.filter((e) => e.p.kind === "transition");

  return (
    <div className="space-y-3">
      <div>
        <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
        <h1 className="flex items-center gap-2 text-2xl font-black"><FlaskConical size={22} className="text-[#00e0a4]" /> Preview Lab</h1>
        <p className="text-sm text-muted">Every tool here is a preview. Nothing changes your settings unless you press a button that says so, and experiments stay off until you switch them on.</p>
      </div>
      <nav aria-label="Lab tools" className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
        {labs.map((l) => <a key={l.id} href={`#${l.id}`} className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-brand">{l.name}</a>)}
      </nav>

      <Tool i={lab("lab.live_ring_preview")}>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {rings.map((r) => (
            <button key={r.id} type="button" onClick={() => tryOn.set("ring", t.ring === r.id ? null : r.id)} aria-pressed={t.ring === r.id}
              className={clsx("flex flex-col items-center gap-1 rounded-xl p-2", t.ring === r.id ? "bg-brand/15 ring-1 ring-brand" : "hover:bg-card-2")}>
              <RingAvatar ring={r.p} size={46} name={profile.display_name} src={profile.avatar_url} />
              <span className="line-clamp-1 text-[10px] font-semibold">{r.name}</span>
            </button>
          ))}
        </div>
      </Tool>

      <Tool i={lab("lab.banner_animation_preview")}>
        <Pick items={banners} value={banner} onChange={setBanner} label="Banner" />
        <BannerArt p={ITEM_BY_ID[banner].p as BannerP} className="mt-2 h-40 rounded-xl" />
      </Tool>

      <Tool i={lab("lab.theme_preview")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {themes.map((th) => (
            <button key={th.id} type="button" onClick={() => tryOn.set("theme", t.theme === th.id ? null : th.id)} aria-pressed={t.theme === th.id}
              className={clsx("overflow-hidden rounded-xl border text-left", t.theme === th.id ? "border-brand" : "border-line")}>
              <div className="pointer-events-none h-20"><ItemPreview i={th} /></div>
              <div className="truncate px-2 py-1 text-[11px] font-semibold">{th.name}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Tapping a theme previews it across the whole app until you end the try-on.</p>
      </Tool>

      <Tool i={lab("lab.profile_layout_preview")}>
        <Pick items={layouts} value={layout} onChange={setLayout} label="Layout" />
        <div className="mt-2 flex gap-2">
          <div className="h-40 w-32 shrink-0 overflow-hidden rounded-xl border border-line"><ItemPreview i={ITEM_BY_ID[layout]} /></div>
          <div className="text-sm text-ink-2">
            {ITEM_BY_ID[layout].desc}
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={() => tryOn.set("layout", layout)}>Try on my profile</Button>
              <Link href={`/u/${profile.username}`} className="self-center text-sm font-bold text-brand">Open my profile</Link>
            </div>
          </div>
        </div>
      </Tool>

      <Tool i={lab("lab.reaction_preview")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {reactions.map((r) => (
            <button key={r.id} ref={(el) => { reactRefs.current[r.id] = el; }} type="button" onClick={() => burst("❤️", reactRefs.current[r.id], r.p)}
              className="rounded-xl border border-line px-2 py-2 text-xs font-semibold hover:border-brand">
              ❤️ {r.name}
            </button>
          ))}
        </div>
      </Tool>

      <Tool i={lab("lab.badge_display_preview")}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {badges.map((b) => (
            <div key={b.id} className="flex items-center gap-1.5 rounded-xl bg-card-2 px-2 py-1.5 text-sm">
              <span className="truncate font-bold">{profile.display_name}</span><BadgeArt p={b.p} size={18} title={b.name} />
            </div>
          ))}
        </div>
      </Tool>

      <Tool i={lab("lab.chat_theme_preview")}>
        <Pick items={chats} value={chat} onChange={setChat} label="Chat theme" />
        <div className="mt-2 h-40 overflow-hidden rounded-xl border border-line"><ItemPreview i={ITEM_BY_ID[chat]} big /></div>
      </Tool>

      <Tool i={lab("lab.nameplate_preview")}>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {nameplates.map((n) => (
            <div key={n.id} className="flex items-center gap-2 rounded-xl bg-[#0b0b0b] px-3 py-2">
              <span className="text-sm font-bold text-white">{profile.display_name}</span><Nameplate p={n.p} />
            </div>
          ))}
        </div>
      </Tool>

      <Tool i={lab("lab.particle_preview")}>
        <Pick items={effects.filter((e) => e.p.kind === "particles")} value={effect} onChange={setEffect} label="Effect" />
        <div className="relative mt-2 h-44 overflow-hidden rounded-xl bg-[#060606]">
          <AmbientEffect key={effect} p={ITEM_BY_ID[effect].p as EffectP} contained />
          <span className="absolute bottom-2 start-3 text-xs text-white/60">Stops automatically with reduced motion or data saver.</span>
        </div>
      </Tool>

      <Tool i={lab("lab.transition_preview")}>
        <div className="flex flex-wrap gap-2">
          {transitions.map((e) => (
            <Button key={e.id} variant="outline" onClick={() => { setTransId(e.id); setTransition((n) => n + 1); }}>{e.name}</Button>
          ))}
        </div>
        <TransitionFlash p={ITEM_BY_ID[transId].p as EffectP} play={transition} />
      </Tool>

      <Tool i={lab("lab.collection_cover_preview")}>
        <Pick items={collectionTemplates} value={cover} onChange={setCover} label="Cover" />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(cols?.length ? cols.slice(0, 6) : [{ id: "x", name: "Your collection", emoji: "📁" }]).map((c) => (
            <CoverArt key={c.id} p={ITEM_BY_ID[cover].p as CollectionP} emoji={c.emoji} className="h-24 rounded-xl">
              <span className="absolute bottom-1.5 start-2 text-[11px] font-bold text-white drop-shadow">{c.name}</span>
            </CoverArt>
          ))}
        </div>
      </Tool>

      <Tool i={lab("lab.creator_dashboard_preview")}>
        <p className="text-sm text-ink-2">Every dashboard uses your real numbers. <Link href="/pro/analytics" className="font-bold text-brand">Open analytics</Link></p>
      </Tool>

      <Tool i={lab("lab.interest_hub_preview")}>
        <div className="flex flex-wrap gap-1.5">
          {hubs.map((h) => <Link key={h.id} href={`/pro/hubs/${h.id}`} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:border-brand">{h.p.emoji} {h.name}</Link>)}
        </div>
      </Tool>

      <Tool i={lab("lab.profile_timeline_preview")}>
        <ol className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {milestones.map((m) => {
            const earned = Boolean(me?.milestones[m.p.key]);
            const prog = Math.min(me?.progress[m.p.key] ?? 0, m.p.goal);
            return (
              <li key={m.id} className="flex flex-col items-center text-center" title={m.p.rule}>
                <MilestoneEmblem p={m.p as MilestoneP} earned={earned} size={44} />
                <span className="mt-1 line-clamp-1 text-[10px] font-semibold">{m.name}</span>
                <span className="text-[9px] text-muted">{earned ? "Earned" : `${prog}/${m.p.goal}`}</span>
              </li>
            );
          })}
        </ol>
      </Tool>

      <Tool i={lab("lab.seasonal_cosmetic_preview")}>
        <ProfileMock look={SETS.find((s) => s.id === "sakura_after_dark")!.look!} name={profile.display_name} username={profile.username} avatar={profile.avatar_url} />
      </Tool>

      <Tool i={lab("lab.new_theme_preview")}>
        <div className="flex flex-wrap items-center gap-3">
          <input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(Number(e.target.value))} aria-label="Colour" className="flex-1" style={{ accentColor: `hsl(${hue},90%,50%)` }} />
          <div className="flex gap-1 rounded-full border border-line p-0.5 text-xs font-bold">
            {(["dark", "light"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={clsx("rounded-full px-2.5 py-1", mode === m && "bg-brand text-white")}>{m}</button>)}
          </div>
        </div>
        <div className="mt-2 h-24 overflow-hidden rounded-xl border border-line"><ItemPreview i={{ ...themes[0], p: forged }} /></div>
        <p className="mt-1 text-xs text-muted">Text contrast {ratio(forged.ink, forged.card).toFixed(1)}:1 · secondary {ratio(forged.muted, forged.card).toFixed(1)}:1</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { if (forging) applyTheme(null); setForging(!forging); }}>{forging ? "Stop previewing" : "Preview on the app"}</Button>
          <Button onClick={async () => {
            try {
              await rpc("save_theme", { p_name: `Forge ${hue}°`, p_accent_hue: hue, p_theme: mode });
              toast("Saved to your looks (colour and mode).", "success", "◐");
            } catch (err) { toastError(err); }
          }}>Save colour as a look</Button>
        </div>
      </Tool>

      <Tool i={lab("lab.experimental_effects")}>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-card-2 p-3 text-sm">
          <span>Allow experimental items ({BY_CATEGORY.effect.filter((e) => e.status === "experimental").map((e) => e.name).join(", ")}). Off by default.</span>
          <input type="checkbox" checked={expOn} className="h-5 w-5"
            onChange={async (e) => {
              try {
                await saveProSettings({ labs: e.target.checked ? [...labsOn, "lab.experimental_effects"] : labsOn.filter((x) => x !== "lab.experimental_effects") });
              } catch (err) { toastError(err); }
            }} />
        </label>
      </Tool>

      <Tool i={lab("lab.cosmetic_bundle_preview")}>
        <select value={bundle} onChange={(e) => setBundle(e.target.value)} aria-label="Collection" className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm">
          {SETS.filter((s) => s.look).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <ProfileMock look={SETS.find((s) => s.id === bundle)!.look!} name={profile.display_name} username={profile.username} avatar={profile.avatar_url} className="mt-2" />
        <Button variant="outline" className="mt-2" onClick={() => tryOn.setMany(SETS.find((s) => s.id === bundle)!.look!)}>Try the whole look</Button>
      </Tool>

      <Tool i={lab("lab.future_collection_preview")}>
        <p className="mb-2 text-sm text-ink-2">A concept, remixed from pieces already in the catalog. It isn&apos;t a promise, a countdown or something for sale.</p>
        <ProfileMock look={{ ring: future[0].id, banner: future[1].id, nameplate: future[2].id, badge: future[3].id }} name={profile.display_name} username={profile.username} avatar={profile.avatar_url} />
      </Tool>

      <Tool i={lab("lab.customization_sandbox")}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["ring", "banner", "nameplate", "badge"] as const).map((s) => (
            <Pick key={s} items={BY_CATEGORY[s]} value={sandbox[s] ?? ""} onChange={(id) => setSandbox((x) => ({ ...x, [s]: id }))} label={s} />
          ))}
        </div>
        <ProfileMock look={sandbox} name={profile.display_name} username={profile.username} avatar={profile.avatar_url} className="mt-2" />
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={() => tryOn.setMany(sandbox)}>Try this on</Button>
          <span className="self-center text-xs text-muted">Current try-on: {Object.values(look).filter(Boolean).length} slots</span>
        </div>
      </Tool>
    </div>
  );
}
