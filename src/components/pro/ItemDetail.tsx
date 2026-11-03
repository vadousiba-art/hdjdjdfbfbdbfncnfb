"use client";

import { useEffect, useState } from "react";
import { usePayPalBilling } from "@/components/pro/PayPalSubscribe";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Heart, Lock, RotateCcw } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { SET_BY_ID } from "@/lib/pro/sets";
import { slotFor, type Item } from "@/lib/pro/types";
import { equip, ownsItem, rememberViewed, saveProSettings, toggleWish, tryOn, useMyPro, useTryOn } from "@/lib/client/pro";
import { ItemPreview } from "./ItemPreview";
import { CAT_LABEL, ExperimentalChip, RarityChip, StateChip, unlockText } from "./ui";

// Where the functional items are used (they aren't "worn").
function whereUsed(i: Item): { href: string; label: string } | null {
  switch (i.cat) {
    case "draft": return { href: `/pro/studio?template=${i.id}`, label: "Start a draft" };
    case "planner": return { href: `/pro/studio?plan=${i.id}`, label: "Plan with this" };
    case "collection": return { href: `/collections?template=${i.id}`, label: "Use on a collection" };
    case "hub": return { href: `/pro/hubs/${i.id}`, label: "Open hub" };
    case "lab": return { href: `/pro/lab#${i.id}`, label: "Open in the Lab" };
    case "hubview": return { href: `/pro/hub#${i.id}`, label: "Open in the hub" };
    case "dashboard":
    case "insight": return { href: `/pro/analytics`, label: "Open analytics" };
    case "feed": return { href: `/pro/feeds?preset=${i.id}`, label: "Preview feed" };
    default: return null;
  }
}

export function ItemDetail({ i, onClose }: { i: Item | null; onClose: () => void }) {
  const billing = usePayPalBilling();
  const { data: me } = useMyPro();
  const { me: profile } = useShell();
  const { toast, toastError } = useApp();
  const router = useRouter();
  const t = useTryOn();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (i) rememberViewed(i.id);
  }, [i]);
  if (!i) return null;
  const owned = ownsItem(i, me);
  const slot = slotFor(i.cat);
  const on = Boolean(slot && me?.equips[slot]?.item === i.id && me.equips[slot]?.active);
  const trying = Boolean(slot && t[slot] === i.id);
  const wished = me?.wishlist.includes(i.id);
  const use = whereUsed(i);
  const set = SET_BY_ID[i.set];
  const labOff = i.status === "experimental" && i.cat !== "lab" && !me?.settings.labs?.includes("lab.experimental_effects");
  const pinned = i.cat === "hub" && me?.settings.pinned_hubs?.includes(i.id);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok, "success", "✦");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={i.name} wide>
      <div className="overflow-hidden rounded-2xl border border-line">
        <ItemPreview i={i} big name={profile.display_name} avatar={profile.avatar_url} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StateChip i={i} me={me} />
        <RarityChip r={i.rarity} />
        {i.status === "experimental" && <ExperimentalChip />}
        <span className="text-xs text-muted">
          {CAT_LABEL[i.cat].name} · <Link href={`/pro/shop?set=${i.set}`} className="underline-offset-2 hover:underline">{set?.name}</Link>
        </span>
      </div>
      <p className="mt-2 text-[15px] text-ink-2">{i.desc}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
        {!owned && <Lock size={14} />} {unlockText(i, me)}
      </p>
      {labOff && owned && <p className="mt-1 text-sm text-muted">Experimental: turn on Experimental Effects in the Preview Lab to equip it.</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {slot && !on && owned && !labOff && (
          <Button disabled={busy} onClick={() => run(() => equip(slot, i.id), `${i.name} equipped.`)}>Equip</Button>
        )}
        {slot && on && (
          <Button variant="outline" disabled={busy} onClick={() => run(() => equip(slot, null), "Back to the default.")}>Unequip</Button>
        )}
        {slot && !on && (
          <Button variant="outline" onClick={() => (trying ? tryOn.set(slot, null) : tryOn.set(slot, i.id))}>
            <Eye size={16} /> {trying ? "Stop trying on" : "Try on"}
          </Button>
        )}
        {i.cat === "hub" && owned && (
          <Button variant="outline" disabled={busy}
            onClick={() => run(() => saveProSettings({ pinned_hubs: pinned ? (me?.settings.pinned_hubs ?? []).filter((x) => x !== i.id) : [...(me?.settings.pinned_hubs ?? []), i.id] }), pinned ? "Unpinned." : "Pinned to your hubs.")}>
            {pinned ? "Unpin" : "Pin hub"}
          </Button>
        )}
        {use && (
          <Button variant={slot ? "outline" : undefined} onClick={() => { onClose(); router.push(use.href); }} disabled={!owned && !["hub", "feed", "lab", "hubview", "dashboard", "insight"].includes(i.cat)}>
            {use.label}
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => run(() => toggleWish(i.id), wished ? "Removed from your wishlist." : "Saved to your wishlist.")}
          aria-pressed={wished}>
          <Heart size={16} className={clsx(wished && "fill-brand text-brand")} /> {wished ? "Wishlisted" : "Wishlist"}
        </Button>
        {trying && (
          <Button variant="outline" onClick={() => tryOn.clear()}><RotateCcw size={16} /> Clear try-on</Button>
        )}
      </div>
      {!owned && i.unlock === "pro" && (
        <p className="mt-3 rounded-xl border border-line bg-card-2 p-3 text-xs text-ink-2">
          Trying on shows it only to you, in this tab. It doesn&apos;t unlock or save anything.{" "}
          {billing?.enabled ? <>Get it with <a href="/pro#membership" className="font-bold text-brand">YORU Pro</a>.</> : "YORU Pro purchases aren't open yet."}
        </p>
      )}
    </Modal>
  );
}
