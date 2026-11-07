"use client";

import { useSyncExternalStore } from "react";
import { mutate } from "swr";
import { rpc } from "./api";
import { byFn, useRpc } from "./hooks";
import { CATALOG_VERSION, item, owns } from "@/lib/pro/catalog";
import type { Item, Slot } from "@/lib/pro/types";

// Pro Universe needs migration 0009. Until it exists the probe fails and every
// Pro surface stays hidden (same approach as Open Gates).
export function useProUniverse() {
  const { data, error, isLoading } = useRpc<number>("pro_universe_version", {}, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 10 * 60_000,
  });
  return { ready: !isLoading || Boolean(error), available: !error && typeof data === "number" && data >= CATALOG_VERSION };
}

export type Membership = {
  pro: boolean;
  status: "active" | "comp" | "expired" | "none";
  until: string | null;
  source: string | null;
  billing: "not_connected";
};
export type ProSettings = {
  labs?: string[];
  sound_volume?: number;
  sounds_on?: boolean;
  show_timeline?: boolean;
  effects_on?: boolean;
  ring_motion?: boolean;
  layout_order?: string[];
  dashboard_widgets?: string[];
  insight_widgets?: string[];
  muted_words?: string[];
  hub_tags?: string[];
  pinned_hubs?: string[];
  feed_custom?: { sort?: "latest" | "top"; media?: "any" | "image" | "video" | "text"; tags?: string[]; kinds?: string[]; days?: number | null; muted?: boolean };
};
export type MyPro = {
  version: number;
  role?: "owner" | "admin" | "member"; // added in migration 0010
  id?: string; // added in migration 0012 (for personal staff sets)
  membership: Membership;
  milestones: Record<string, string>;
  progress: Record<string, number>;
  equips: Partial<Record<Slot, { item: string; active: boolean }>>;
  wishlist: string[];
  settings: ProSettings;
  scheduler: { running: boolean; last_run: string | null };
  limits: { drafts: number; scheduled: number };
};

export function useMyPro() {
  const { available } = useProUniverse();
  return useRpc<MyPro>(available ? "get_my_pro" : null, {}, { revalidateOnFocus: false });
}

export const refreshPro = () => mutate(byFn("get_my_pro", "get_profile_identity", "get_profile", "get_feed", "get_post"));

// What the member owns, as the UI should show it. The server decides for real.
export function ownsItem(i: Item, me: MyPro | undefined) {
  return owns(i, me ? { pro: me.membership.pro, milestones: Object.keys(me.milestones), tester: me.membership.status === "comp", role: me.role, id: me.id } : null);
}

// The item actually in effect for a slot (equipped and still owned).
export function equipped<P = Record<string, unknown>>(me: MyPro | undefined, slot: Slot): Item<P> | undefined {
  const e = me?.equips[slot];
  return e?.active ? item<P>(e.item) : undefined;
}

export async function equip(slot: Slot, id: string | null) {
  await rpc("pro_equip", { p_slot: slot, p_item: id });
  await refreshPro();
}
export async function equipMany(look: Partial<Record<Slot, string>>) {
  const r = await rpc<{ skipped: string[] }>("pro_equip_many", { p: look });
  await refreshPro();
  return r.skipped;
}
export async function resetLook() {
  await rpc("pro_reset_look");
  await refreshPro();
}
export async function toggleWish(id: string) {
  const r = await rpc<{ wished: boolean }>("pro_wishlist_toggle", { p_item: id });
  await mutate(byFn("get_my_pro"));
  return r.wished;
}
export async function saveProSettings(p: ProSettings) {
  const out = await rpc<ProSettings>("pro_save_settings", { p });
  await mutate(byFn("get_my_pro"), (cur: MyPro | undefined) => (cur ? { ...cur, settings: out } : cur), { revalidate: false });
  return out;
}

// ---------------------------------------------------------------------------
// Try-on preview. Lives only in this tab's memory: it never reaches the
// server, so previewing can't unlock or equip anything.
// ---------------------------------------------------------------------------

type Preview = Partial<Record<Slot, string | null>>;
let preview: Preview = {};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const tryOn = {
  set(slot: Slot, id: string | null) {
    preview = { ...preview, [slot]: id };
    emit();
  },
  setMany(p: Preview) {
    preview = { ...preview, ...p };
    emit();
  },
  clear() {
    preview = {};
    emit();
  },
};
export function useTryOn(): Preview {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => preview,
    () => preview,
  );
}

// Equipped look with the try-on layered on top (for previews only).
export function lookWith(me: MyPro | undefined, p: Preview, slot: Slot): string | undefined {
  if (slot in p) return p[slot] ?? undefined;
  const e = me?.equips[slot];
  return e?.active ? e.item : undefined;
}

// ---------------------------------------------------------------------------
// Recently viewed: a convenience kept on this device only.
// ---------------------------------------------------------------------------

const RECENT_KEY = "yoru:pro:recent";
export function rememberViewed(id: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...cur.filter((x) => x !== id)].slice(0, 24)));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}
export function recentlyViewed(): string[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[]).filter((id) => item(id));
  } catch {
    return [];
  }
}

export function reducedMotion() {
  if (typeof window === "undefined") return true;
  const pref = document.documentElement.dataset.motion;
  if (pref === "reduce") return true;
  if (pref === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
