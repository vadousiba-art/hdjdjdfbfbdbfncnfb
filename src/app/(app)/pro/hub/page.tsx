"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { Button, Empty } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useRpc } from "@/lib/client/hooks";
import { CATALOG, ITEM_BY_ID, STAFF, hubViews } from "@/lib/pro/catalog";
import { SETS } from "@/lib/pro/sets";
import { CATEGORIES, SLOTS, type Item, type Slot } from "@/lib/pro/types";
import { equip, equipped, ownsItem, recentlyViewed, resetLook, saveProSettings, useMyPro, useProUniverse } from "@/lib/client/pro";
import { playSound } from "@/lib/client/pro-fx";
import type { SoundP } from "@/lib/pro/catalog";
import { ItemCard } from "@/components/pro/ItemCard";
import { ItemDetail } from "@/components/pro/ItemDetail";
import { ItemPreview } from "@/components/pro/ItemPreview";
import { CAT_LABEL, SLOT_LABEL } from "@/components/pro/ui";
import type { MessageKey } from "@/lib/i18n/messages/en";

const BENEFITS: MessageKey[] = ["pro.b.cosmetics", "pro.b.themes", "pro.b.badge", "pro.b.shield", "pro.b.early"];
const FEATURED_SET = "sakura_after_dark";
const subscribeNoop = () => () => {};

export default function HubPage() {
  return (
    <Gate>
      <Hub />
    </Gate>
  );
}

function View({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  const v = ITEM_BY_ID[id];
  return (
    <section id={id} className="card scroll-mt-28 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-black">{v.name}</h2>
          <p className="text-xs text-muted">{v.desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Grid({ items, onOpen, empty }: { items: Item[]; onOpen: (i: Item) => void; empty: string }) {
  const { data: me } = useMyPro();
  if (!items.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => <ItemCard key={i.id} i={i} me={me} onOpen={onOpen} />)}
    </div>
  );
}

function Hub() {
  const { t, formatDate } = useI18n();
  const { available } = useProUniverse();
  const { data: me, isLoading } = useMyPro();
  const { data: themes } = useRpc<{ id: string; name: string; accent_hue: number; theme: string }[]>("get_my_themes");
  const { toast, toastError } = useApp();
  const [open, setOpen] = useState<Item | null>(null);
  const [showFree, setShowFree] = useState(false);
  const recent = useSyncExternalStore(subscribeNoop, () => recentlyViewed().join(","), () => "");

  if (!available) return <Empty emoji="🌙" text="The membership hub switches on with the next database update." />;
  if (isLoading || !me) return <Empty emoji="🌙" text="Loading your hub…" />;

  const m = me.membership;
  const owned = [...STAFF, ...CATALOG].filter((i) => ownsItem(i, me) && (showFree || i.unlock !== "free"));
  const equippedSlots = (Object.keys(SLOTS) as Slot[]).filter((s) => me.equips[s]);
  const equippedSets = new Set(equippedSlots.map((s) => ITEM_BY_ID[me.equips[s]!.item]?.set));
  const recommended = CATALOG.filter((i) => equippedSets.has(i.set) && !Object.values(me.equips).some((e) => e?.item === i.id)).slice(0, 8);
  const statusText = { active: "Active", comp: "Active (complimentary)", expired: "Ended", none: "Not a member" }[m.status];
  const until = m.until && m.until !== "infinity" ? formatDate(m.until) : null;

  return (
    <div className="space-y-3">
      <div>
        <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
        <h1 className="text-2xl font-black">Membership hub</h1>
      </div>
      <nav aria-label="Hub sections" className="sticky top-14 z-10 -mx-3 flex gap-1.5 overflow-x-auto bg-bg/90 px-3 py-2 backdrop-blur">
        {hubViews.map((v) => (
          <a key={v.id} href={`#${v.id}`} className="shrink-0 rounded-full border border-line bg-card px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-brand">
            {v.p.icon} {v.name}
          </a>
        ))}
      </nav>

      <section className="card space-y-2 p-4" aria-labelledby="prefs">
        <h2 id="prefs" className="font-black">Preferences</h2>
        {([
          ["sounds_on", "Notification sounds", "Off unless you turn it on. Plays your chosen sound when a notification arrives.", me.settings.sounds_on === true],
          ["effects_on", "Interface effects", "Your equipped effect. Always off with reduced motion or data saver.", me.settings.effects_on !== false],
          ["show_timeline", "Show my milestone timeline on my profile", "Other members see the milestones you've earned.", me.settings.show_timeline !== false],
        ] as const).map(([k, l, hint, on]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-card-2 px-3 py-2 text-sm">
            <span><span className="font-semibold">{l}</span><span className="block text-xs text-muted">{hint}</span></span>
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={(e) => saveProSettings({ [k]: e.target.checked }).catch(toastError)} />
          </label>
        ))}
        <div className="flex items-center gap-3 rounded-xl bg-card-2 px-3 py-2 text-sm">
          <span className="shrink-0 font-semibold">Volume</span>
          <input type="range" min={0} max={100} defaultValue={me.settings.sound_volume ?? 60} aria-label="Notification volume" className="min-w-0 flex-1"
            onPointerUp={(e) => saveProSettings({ sound_volume: Number((e.target as HTMLInputElement).value) }).catch(toastError)}
            onKeyUp={(e) => saveProSettings({ sound_volume: Number((e.target as HTMLInputElement).value) }).catch(toastError)} />
          <button type="button" className="shrink-0 text-xs font-bold text-brand" disabled={!equipped<SoundP>(me, "sound")}
            onClick={() => { const s = equipped<SoundP>(me, "sound"); if (s) playSound(s.p, me.settings.sound_volume ?? 60); }}>
            {equipped(me, "sound") ? "Test" : "No sound chosen"}
          </button>
        </div>
      </section>

      <View id="hubview.membership_overview">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Status", statusText], ["Owned", String(CATALOG.filter((i) => ownsItem(i, me)).length)], ["Equipped", String(equippedSlots.length)]].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-card-2 py-2">
              <div className="text-sm font-black">{v}</div>
              <div className="text-[10px] font-bold uppercase text-muted">{l}</div>
            </div>
          ))}
        </div>
      </View>

      <View id="hubview.owned_cosmetics" action={<label className="flex shrink-0 items-center gap-1.5 text-xs"><input type="checkbox" checked={showFree} onChange={(e) => setShowFree(e.target.checked)} /> Show free</label>}>
        <Grid items={owned.slice(0, 24)} onOpen={setOpen} empty={m.pro ? "Nothing yet." : "Free items are yours already (tick Show free). Earned items appear here as you reach milestones."} />
        {owned.length > 24 && <Link href="/pro/shop" className="mt-2 block text-sm font-bold text-brand">See all {owned.length} in the catalog</Link>}
      </View>

      <View id="hubview.equipped_items" action={equippedSlots.length > 0 && (
        <Button variant="outline" className="shrink-0 !px-3 !py-1.5 text-xs" onClick={async () => {
          if (!confirm("Take everything off and go back to the defaults?")) return;
          try { await resetLook(); toast("Back to the defaults.", "success", "↺"); } catch (err) { toastError(err); }
        }}><RotateCcw size={14} /> Reset all</Button>
      )}>
        {equippedSlots.length === 0 ? <p className="text-sm text-muted">Nothing equipped. Everything is on the default.</p> : (
          <ul className="divide-y divide-line">
            {equippedSlots.map((s) => {
              const e = me.equips[s]!;
              const i = ITEM_BY_ID[e.item];
              return (
                <li key={s} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="text-muted">{SLOT_LABEL[s]}{SLOTS[s].public ? "" : " (only you)"}: </span>
                    <button type="button" className="font-bold hover:text-brand" onClick={() => setOpen(i)}>{i?.name}</button>
                    {!e.active && <span className="ms-1 text-xs text-muted">· paused until you have it again</span>}
                  </span>
                  <button type="button" className="shrink-0 text-xs font-bold text-brand" onClick={() => equip(s, null).catch(toastError)}>Unequip</button>
                </li>
              );
            })}
          </ul>
        )}
      </View>

      <View id="hubview.saved_themes" action={<Link href="/settings" className="shrink-0 text-xs font-bold text-brand">Theme settings</Link>}>
        {themes?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {themes.map((th) => <span key={th.id} className="rounded-full border border-line px-2.5 py-1 text-xs"><span className="me-1 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: `hsl(${th.accent_hue},90%,50%)` }} />{th.name}</span>)}
          </div>
        ) : <p className="text-sm text-muted">No saved looks yet. Save one in Settings → Appearance.</p>}
      </View>

      <View id="hubview.featured_collections" action={<Link href="/pro/shop?view=sets" className="shrink-0 text-xs font-bold text-brand">All</Link>}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {SETS.filter((s) => s.look).map((s) => (
            <Link key={s.id} href={`/pro/shop?set=${s.id}`} className="w-36 shrink-0 overflow-hidden rounded-xl border border-line">
              <div className="pointer-events-none h-14"><ItemPreview i={ITEM_BY_ID[s.look!.banner]} /></div>
              <div className="truncate p-1.5 text-[11px] font-black">{s.name.toUpperCase()}</div>
            </Link>
          ))}
        </div>
      </View>

      <View id="hubview.new_arrivals">
        <p className="mb-2 text-sm text-ink-2">Catalog v1 is the first release, so everything is new. Later additions will be listed here.</p>
        <Grid items={CATALOG.filter((i) => i.rarity === "legendary").slice(0, 8)} onOpen={setOpen} empty="" />
      </View>

      <View id="hubview.recommended_cosmetics">
        <Grid items={recommended} onOpen={setOpen} empty="Equip something and we'll suggest pieces from the same collection." />
      </View>

      <View id="hubview.seasonal_collection">
        <p className="mb-2 text-sm text-ink-2">Featured this season: <b>Sakura After Dark</b>. It isn&apos;t limited; it stays in the catalog.</p>
        <Grid items={CATALOG.filter((i) => i.set === FEATURED_SET).slice(0, 4)} onOpen={setOpen} empty="" />
      </View>

      <View id="hubview.cosmetic_categories">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {CATEGORIES.map((c) => <Link key={c} href={`/pro/shop?cat=${c}`} className="rounded-lg border border-line px-2 py-1.5 text-xs font-semibold hover:border-brand">{CAT_LABEL[c].name}</Link>)}
        </div>
      </View>

      <View id="hubview.search_and_filters">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <Link href="/pro/shop" className="block w-full rounded-full border border-line bg-card py-2 ps-9 text-sm text-muted">Search the catalog…</Link>
        </div>
      </View>

      <View id="hubview.wishlist">
        <Grid items={me.wishlist.map((id) => ITEM_BY_ID[id]).filter(Boolean)} onOpen={setOpen} empty="Tap the heart on any item to save it here." />
      </View>

      <View id="hubview.recently_viewed">
        <Grid items={recent ? recent.split(",").slice(0, 8).map((id) => ITEM_BY_ID[id]).filter(Boolean) : []} onOpen={setOpen} empty="Items you open appear here (kept on this device only)." />
      </View>

      <View id="hubview.item_preview">
        <button type="button" onClick={() => setOpen(ITEM_BY_ID["ring.infinite_night"])} className="w-full overflow-hidden rounded-xl border border-line">
          <div className="pointer-events-none h-40"><ItemPreview i={ITEM_BY_ID["ring.infinite_night"]} big /></div>
        </button>
      </View>

      <View id="hubview.collection_completion">
        <ul className="space-y-2">
          {SETS.map((s) => {
            const items = CATALOG.filter((i) => i.set === s.id);
            const n = items.filter((i) => ownsItem(i, me)).length;
            return (
              <li key={s.id}>
                <div className="flex justify-between text-xs"><Link href={`/pro/shop?set=${s.id}`} className="font-bold hover:text-brand">{s.name}</Link><span className="text-muted">{n}/{items.length}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-2"><div className="h-full bg-brand" style={{ width: `${(n / items.length) * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </View>

      <View id="hubview.membership_benefits">
        <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">{BENEFITS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        <p className="mt-2 text-xs text-muted">Pro never changes how your posts are ranked or who sees them.</p>
      </View>

      <View id="hubview.feature_availability">
        <table className="w-full text-left text-xs">
          <thead className="text-muted"><tr><th className="py-1 font-semibold">System</th><th className="font-semibold">Items</th><th className="font-semibold">State</th></tr></thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const items = CATALOG.filter((i) => i.cat === c);
              const ex = items.filter((i) => i.status === "experimental").length;
              return <tr key={c} className="border-t border-line"><td className="py-1">{CAT_LABEL[c].name}</td><td>{items.length}</td><td>{ex ? `Available (${ex} experimental)` : "Available"}</td></tr>;
            })}
            <tr className="border-t border-line"><td className="py-1">Checkout and billing</td><td>–</td><td>Available (Interac e-Transfer)</td></tr>
          </tbody>
        </table>
      </View>

      <View id="hubview.membership_status">
        <p className="text-sm">
          <b>{statusText}</b>
          {m.pro && (until ? ` until ${until}` : " with no end date")}
          {m.status === "comp" && ". Granted by the YORU team."}
          {m.status === "expired" && ". Your Pro items are paused, not deleted, and come back if Pro is renewed."}
        </p>
      </View>

      <View id="hubview.billing_information">
        {m.source === "etransfer" && m.pro ? (
          <p className="text-sm text-ink-2">
            Paid by Interac e-Transfer{until ? `, so Pro runs until ${until}` : ""}. Nothing renews by itself and no payment details are stored.{" "}
            <Link href="/pro/checkout" className="font-bold text-brand">Add a month</Link>
          </p>
        ) : (
          <p className="text-sm text-ink-2">
            No payment details are stored on YORU. {t("pro.price")}, paid by Interac e-Transfer from your own bank; each payment adds one month.{" "}
            <Link href="/pro/checkout" className="font-bold text-brand">{m.pro ? "Add a month" : "Get Pro"}</Link>
          </p>
        )}
      </View>

      <View id="hubview.cancellation_guidance">
        <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
          <li>Nothing renews by itself, so there&apos;s nothing to cancel: Pro simply ends when the months you paid for run out. Pay again any time to add a month.</li>
          <li>Equipped Pro items switch back to the defaults; your choices are remembered if you come back.</li>
          <li>Drafts, scheduled posts, collections and earned milestones are never deleted. Free limits apply to new drafts and schedules.</li>
        </ul>
      </View>

      <View id="hubview.updates_and_announcements">
        <p className="text-sm text-ink-2"><b>Catalog v1.</b> 400 items in 20 systems, ten signature collections, earned milestones, Draft Studio, the Post Planner, analytics and insights.</p>
      </View>

      <ItemDetail i={open} onClose={() => setOpen(null)} />
    </div>
  );
}
