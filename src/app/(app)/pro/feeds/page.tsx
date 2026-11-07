"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Gate } from "@/components/yoru/Gate";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { Feed } from "@/components/feed/Feed";
import { feedPresets, item, type FeedP } from "@/lib/pro/catalog";
import { equip, ownsItem, saveProSettings, useMyPro, useProUniverse, type ProSettings } from "@/lib/client/pro";
import { ItemPreview } from "@/components/pro/ItemPreview";

// Advanced Feed Controls (11). Each preset is a set of real filters run by
// the database. They change what you see, never anyone's ranking or reach.
export default function FeedsPage() {
  return (
    <Gate>
      <Suspense fallback={<ChaosLoader />}>
        <Feeds />
      </Suspense>
    </Gate>
  );
}

function Feeds() {
  const params = useSearchParams();
  const router = useRouter();
  const { available } = useProUniverse();
  const { data: me } = useMyPro();
  const { toast, toastError } = useApp();
  const fromUrl = params.get("preset");
  const pick = fromUrl && item(fromUrl)?.cat === "feed" ? fromUrl : me?.equips.feed?.active ? me.equips.feed.item : feedPresets[13].id;
  const cur = item<FeedP>(pick)!;
  const owned = ownsItem(cur, me);
  const [muted, setMuted] = useState("");
  const [custom, setCustom] = useState<NonNullable<ProSettings["feed_custom"]> | null>(null);
  const c = custom ?? me?.settings.feed_custom ?? { sort: "latest", media: "any", tags: [], kinds: [], muted: false };

  if (!available) return <Empty emoji="🧭" text="Feed presets switch on with the next database update." />;
  if (!me) return <ChaosLoader />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
        <h1 className="text-2xl font-black">Feed controls</h1>
        <p className="text-sm text-muted">Saved filters for what you see. They never change how anyone&apos;s posts are ranked or who sees them.</p>
      </div>
      <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="listbox" aria-label="Feed presets">
        {feedPresets.map((f) => (
          <button key={f.id} type="button" role="option" aria-selected={pick === f.id} onClick={() => router.replace(`/pro/feeds?preset=${f.id}`, { scroll: false })}
            className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold", pick === f.id ? "border-brand bg-brand text-white" : "border-line bg-card")}>
            {f.name}{ownsItem(f, me) ? "" : " ·"}{ownsItem(f, me) ? "" : f.unlock === "pro" ? " Pro" : " Earn"}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="pointer-events-none h-16"><ItemPreview i={cur} /></div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <p className="min-w-0 flex-1 text-sm text-ink-2">{cur.desc}</p>
          {owned && me.equips.feed?.item !== cur.id && <Button variant="outline" onClick={() => equip("feed", cur.id).then(() => toast("Saved as your feed.", "success", "🧭")).catch(toastError)}>Make my default</Button>}
          {me.equips.feed?.item === cur.id && <span className="text-xs font-bold text-brand">Your default</span>}
        </div>
      </div>

      {cur.p.muted && owned && (
        <form className="card space-y-2 p-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveProSettings({ muted_words: [...(me.settings.muted_words ?? []), ...muted.split(",").map((w) => w.trim()).filter(Boolean)] });
            setMuted("");
          } catch (err) { toastError(err); }
        }}>
          <div className="text-xs font-bold uppercase tracking-widest text-muted">Muted words</div>
          <div className="flex flex-wrap gap-1.5">
            {(me.settings.muted_words ?? []).map((w) => (
              <button key={w} type="button" onClick={() => saveProSettings({ muted_words: (me.settings.muted_words ?? []).filter((x) => x !== w) }).catch(toastError)}
                className="rounded-full bg-card-2 px-2.5 py-1 text-xs" aria-label={`Unmute ${w}`}>{w} ×</button>
            ))}
            {!me.settings.muted_words?.length && <span className="text-xs text-muted">None yet.</span>}
          </div>
          <div className="flex gap-2">
            <input value={muted} onChange={(e) => setMuted(e.target.value)} placeholder="spoiler, finale" aria-label="Add muted words" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm" />
            <Button>Add</Button>
          </div>
        </form>
      )}

      {cur.p.custom && owned && (
        <form className="card grid gap-2 p-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveProSettings({ feed_custom: c });
            setCustom(null);
            toast("Your feed is saved.", "success", "🧭");
          } catch (err) { toastError(err); }
        }}>
          <label className="text-xs">Sort
            <select value={c.sort} onChange={(e) => setCustom({ ...c, sort: e.target.value as "latest" | "top" })} className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm">
              <option value="latest">Newest first</option><option value="top">Most reacted (30 days)</option>
            </select>
          </label>
          <label className="text-xs">Media
            <select value={c.media ?? "any"} onChange={(e) => setCustom({ ...c, media: e.target.value as "any" })} className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm">
              <option value="any">Anything</option><option value="image">Images and GIFs</option><option value="video">Video</option><option value="text">Text only</option>
            </select>
          </label>
          <label className="text-xs sm:col-span-2">Tags (space separated)
            <input value={(c.tags ?? []).join(" ")} onChange={(e) => setCustom({ ...c, tags: e.target.value.split(/[\s,#]+/).filter(Boolean) })} className="mt-1 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm" />
          </label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Boolean(c.muted)} onChange={(e) => setCustom({ ...c, muted: e.target.checked })} /> Hide my muted words</label>
          <Button className="sm:justify-self-end">Save my feed</Button>
        </form>
      )}

      {!owned && <p className="text-xs text-muted">Previewing the first 5 posts. Using this preset is part of YORU Pro.</p>}
      <Feed key={`${pick}-${JSON.stringify(me.settings.feed_custom ?? null)}-${(me.settings.muted_words ?? []).join()}`} mode="preset" arg={pick} preview={!owned} emptyText="Nothing matches this preset yet." />
    </div>
  );
}
