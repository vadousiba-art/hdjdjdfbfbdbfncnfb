import type { Category, Item, MilestoneKey, Rarity, SetId, Status, Unlock } from "../types";

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const R: Record<string, Rarity> = { C: "common", U: "uncommon", R: "rare", E: "epic", L: "legendary" };
export const F: Unlock = "free";
export const P: Unlock = "pro";
export const M = (k: MilestoneKey): Unlock => `milestone:${k}`;

// Row: [name, description, rarity letter, set, unlock, renderer params, status?]
export type Row<T> = [string, string, keyof typeof R, SetId, Unlock, T, Status?];

export function mk<T extends Record<string, unknown>>(cat: Category, rows: Row<T>[]): Item<T>[] {
  return rows.map(([name, desc, r, set, unlock, p, status]) => ({
    id: `${cat}.${slug(name)}`,
    cat,
    name,
    desc,
    rarity: R[r],
    set,
    unlock,
    status: status ?? "available",
    p,
  }));
}
