import type { Category, Item, MilestoneKey, Unlock } from "../types";
import { banners, effects, nameplates, rings, themes } from "./cosmetics-a";
import { badges, chats, layouts, milestones, reactions } from "./cosmetics-b";
import { collectionTemplates, dashboards, draftTemplates, feedPresets, hubViews, hubs, insightLayouts, labs, plannerTemplates, soundPacks } from "./tools";
import { STAFF } from "./staff";

export * from "./cosmetics-a";
export * from "./cosmetics-b";
export * from "./tools";
export * from "./staff";

// Bump when items are added; the database stores the same version (0009).
export const CATALOG_VERSION = 1;

export const BY_CATEGORY: Record<Category, Item[]> = {
  ring: rings,
  banner: banners,
  nameplate: nameplates,
  theme: themes,
  effect: effects,
  badge: badges,
  layout: layouts,
  collection: collectionTemplates,
  draft: draftTemplates,
  dashboard: dashboards,
  feed: feedPresets,
  hub: hubs,
  reaction: reactions,
  insight: insightLayouts,
  chat: chats,
  sound: soundPacks,
  planner: plannerTemplates,
  milestone: milestones,
  lab: labs,
  hubview: hubViews,
};

// The 400-item member catalog. Staff items (STAFF) are separate: they are
// not for sale or earning, and only appear for the staff they belong to.
export const CATALOG: Item[] = Object.values(BY_CATEGORY).flat();
export const ALL_ITEMS: Item[] = [...CATALOG, ...STAFF];
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));
export const isStaffItem = (i: Item) => i.unlock.startsWith("staff:");
export const item = <P = Record<string, unknown>>(id: string | null | undefined) => (id ? (ITEM_BY_ID[id] as Item<P> | undefined) : undefined);

export function milestoneOf(u: Unlock): MilestoneKey | null {
  return u.startsWith("milestone:") ? (u.slice(10) as MilestoneKey) : null;
}

export type Role = "owner" | "admin" | "member";
export function staffAllows(u: Unlock, role: Role | null | undefined, id?: string | null) {
  if (u === "staff:owner") return role === "owner";
  if (u === "staff:admin") return role === "owner" || role === "admin";
  // A personal set: only that account, and only while it is staff.
  if (u.startsWith("staff:member:")) return !!id && u === `staff:member:${id}` && (role === "owner" || role === "admin");
  return false;
}

// What a member can use. The server makes the same decision (pro_owns in 0009)
// and is the one that counts; this only decides what the UI shows as locked.
// Testers (complimentary Pro from an admin) also get milestone-unlocked
// cosmetics; milestones themselves stay earned-only.
export function owns(i: Item, me: { pro: boolean; milestones: readonly string[]; tester?: boolean; role?: Role | null; id?: string | null } | null | undefined): boolean {
  if (i.unlock === "free") return true;
  if (!me) return false;
  if (i.unlock === "pro") return me.pro;
  if (isStaffItem(i)) return staffAllows(i.unlock, me.role, me.id);
  if (me.tester && i.cat !== "milestone") return true;
  return me.milestones.includes(milestoneOf(i.unlock)!);
}
