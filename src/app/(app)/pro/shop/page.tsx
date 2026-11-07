"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Eye, Search, Shirt } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { ChaosLoader, Empty } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { CATALOG, ITEM_BY_ID, STAFF } from "@/lib/pro/catalog";
import { SETS, SET_BY_ID, STAFF_SETS, type CosmeticSet } from "@/lib/pro/sets";
import { CATEGORIES, RARITIES, type Category, type Item, type Rarity } from "@/lib/pro/types";
import { equipMany, ownsItem, recentlyViewed, tryOn, useMyPro, useProUniverse, type MyPro } from "@/lib/client/pro";
import { ItemPreview } from "@/components/pro/ItemPreview";
import { ItemDetail } from "@/components/pro/ItemDetail";
import { ItemCard } from "@/components/pro/ItemCard";
import { CAT_LABEL } from "@/components/pro/ui";

type Filter = "all" | "free" | "pro" | "earned" | "owned" | "wishlist" | "experimental" | "staff";
const FILTERS: [Filter, string][] = [["all", "All"], ["owned", "Yours"], ["free", "Free"], ["pro", "Pro"], ["earned", "Earned"], ["wishlist", "Wishlist"], ["experimental", "Experimental"]];
const PAGE = 36;

export default function ShopPage() {
  return (
    <Gate>
      <Suspense fallback={<ChaosLoader />}>
        <Shop />
      </Suspense>
    </Gate>
  );
}

function SetCard({ s, me }: { s: CosmeticSet; me?: MyPro }) {
  const { toast, toastError } = useApp();
  const items = [...CATALOG, ...STAFF].filter((i) => i.set === s.id);
  const owned = items.filter((i) => ownsItem(i, me)).length;
  const look = s.look ? (Object.fromEntries(Object.entries(s.look)) as Record<string, string>) : null;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${s.palette[0]}, ${s.palette[1]}55)` }}>
        {look && <ItemPreview i={ITEM_BY_ID[look.banner]} />}
      </div>
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/pro/shop?set=${s.id}`} className="font-black tracking-wide hover:text-brand">{s.name.toUpperCase()}</Link>
          <span className="text-xs text-muted">{s.jp}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.tagline}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-2" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={owned} aria-label={`${owned} of ${items.length} owned`}>
          <div className="h-full bg-brand" style={{ width: `${(owned / items.length) * 100}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted">{owned} of {items.length} yours</div>
        {look && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => tryOn.setMany(look)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-bold hover:border-brand">
              <Eye size={13} /> Try the look
            </button>
            <button type="button"
              onClick={async () => {
                try {
                  const skipped = await equipMany(look);
                  toast(skipped.length ? `Wore what you own. ${skipped.length} piece${skipped.length === 1 ? " is" : "s are"} still locked.` : "Look equipped.", "success", "✦");
                } catch (err) {
                  toastError(err);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
              <Shirt size={13} /> Wear what I own
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const subscribeNoop = () => () => {};

function Shop() {
  const params = useSearchParams();
  const router = useRouter();
  const { available } = useProUniverse();
  const { data: me } = useMyPro();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Item | null>(null);
  const cat = (params.get("cat") as Category | null) ?? null;
  const set = params.get("set");
  const view = params.get("view") === "sets" ? "sets" : "items";
  const recent = useSyncExternalStore(subscribeNoop, () => recentlyViewed().join(","), () => "");

  const go = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    setLimit(PAGE);
    router.replace(`/pro/shop${sp.size ? `?${sp}` : ""}`, { scroll: false });
  };

  // Staff items only exist in the shop for the staff they belong to.
  const isStaff = me?.role === "owner" || me?.role === "admin";
  const staffItems = useMemo(() => (isStaff ? STAFF.filter((i) => ownsItem(i, me)) : []), [isStaff, me]);
  const staffSets = isStaff
    ? STAFF_SETS.filter((s) => (s.staff === "member" ? s.member === me?.id : me?.role === "owner" || s.staff === "admin"))
    : [];
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (filter === "staff" ? staffItems : filter === "owned" ? [...staffItems, ...CATALOG] : CATALOG).filter((i) => {
      if (cat && i.cat !== cat) return false;
      if (set && i.set !== set) return false;
      if (rarity && i.rarity !== rarity) return false;
      if (needle && !`${i.name} ${i.desc} ${SET_BY_ID[i.set]?.name} ${CAT_LABEL[i.cat].name}`.toLowerCase().includes(needle)) return false;
      switch (filter) {
        case "free": return i.unlock === "free";
        case "pro": return i.unlock === "pro";
        case "earned": return i.unlock.startsWith("milestone:");
        case "owned": return ownsItem(i, me);
        case "wishlist": return Boolean(me?.wishlist.includes(i.id));
        case "experimental": return i.status === "experimental";
        case "staff": return true;
        default: return true;
      }
    });
  }, [q, cat, set, rarity, filter, me, staffItems]);

  const recentItems = recent ? recent.split(",").slice(0, 8).map((id) => ITEM_BY_ID[id]).filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
          <h1 className="text-2xl font-black">The catalog</h1>
          <p className="text-sm text-muted">400 items across 20 systems. Preview anything; try it on before you equip it.</p>
        </div>
        <Link href="/pro/hub" className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-bold">Your hub</Link>
      </div>
      {!available && (
        <p className="rounded-xl border border-line bg-card-2 p-3 text-sm text-ink-2">
          Equipping switches on with the next database update. You can browse and try things on now.
        </p>
      )}

      <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="tablist">
        {(["items", "sets"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} type="button" onClick={() => go({ view: v === "sets" ? "sets" : null })}
            className={clsx("flex-1 rounded-full py-2 text-sm font-bold", view === v ? "bg-brand text-white" : "text-muted")}>
            {v === "items" ? "Items" : "Collections"}
          </button>
        ))}
      </div>

      {view === "sets" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...staffSets, ...SETS].map((s) => <SetCard key={s.id} s={s} me={me} />)}
        </div>
      ) : (
        <>
          <label className="relative block">
            <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search rings, themes, sets…" aria-label="Search the catalog"
              className="w-full rounded-full border border-line bg-card py-2.5 pe-4 ps-10 text-sm outline-none focus:border-brand" />
          </label>

          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Categories">
            <Chip on={!cat} onClick={() => go({ cat: null })}>All systems</Chip>
            {CATEGORIES.map((c) => <Chip key={c} on={cat === c} onClick={() => go({ cat: c })}>{CAT_LABEL[c].name}</Chip>)}
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Filters">
            {isStaff && <Chip on={filter === "staff"} onClick={() => { setFilter("staff"); setLimit(PAGE); }} small>{me?.role === "owner" ? "♛ Founder & staff" : staffSets.some((s) => s.staff === "member") ? "⚡ Co-founder & staff" : "⛨ Staff"}</Chip>}
            {FILTERS.map(([f, l]) => <Chip key={f} on={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }} small>{l}</Chip>)}
            <span className="mx-1 w-px self-stretch bg-line" />
            {RARITIES.map((r) => <Chip key={r} on={rarity === r} onClick={() => setRarity(rarity === r ? null : r)} small>{r[0].toUpperCase() + r.slice(1)}</Chip>)}
          </div>
          {set && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-card p-3">
              <div>
                <div className="font-black tracking-wide">{SET_BY_ID[set]?.name.toUpperCase()} <span className="font-normal text-muted">{SET_BY_ID[set]?.jp}</span></div>
                <div className="text-xs text-muted">{SET_BY_ID[set]?.tagline}</div>
              </div>
              <button type="button" onClick={() => go({ set: null })} className="text-sm font-bold text-brand">Clear</button>
            </div>
          )}
          {cat && <p className="text-sm text-muted">{String(CAT_LABEL[cat].n).padStart(2, "0")} · {CAT_LABEL[cat].blurb}</p>}

          {recentItems.length > 0 && !q && !cat && !set && filter === "all" && (
            <section>
              <h2 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Recently viewed</h2>
              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
                {recentItems.map((i) => (
                  <div key={i.id} className="w-40 shrink-0"><ItemCard i={i} me={me} onOpen={setOpen} /></div>
                ))}
              </div>
            </section>
          )}

          <div className="text-xs text-muted" aria-live="polite">{items.length} item{items.length === 1 ? "" : "s"}</div>
          {items.length === 0 ? (
            <Empty emoji="🔭" text="Nothing matches. Try fewer filters." />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {items.slice(0, limit).map((i) => <ItemCard key={i.id} i={i} me={me} onOpen={setOpen} />)}
            </div>
          )}
          {items.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full rounded-full border border-line py-2.5 text-sm font-bold hover:border-brand">
              Show more ({items.length - limit} left)
            </button>
          )}
        </>
      )}
      <ItemDetail i={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Chip({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={clsx("shrink-0 rounded-full border font-semibold", small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm", on ? "border-brand bg-brand text-white" : "border-line bg-card text-ink-2 hover:border-brand")}>
      {children}
    </button>
  );
}
