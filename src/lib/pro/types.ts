// YORU Pro catalog types. The catalog is data: every item has a stable id, a
// category, a rarity (a cosmetic label, never a scarcity claim), a collection,
// an honest unlock rule and the parameters its renderer needs. The database
// keeps the same ids, categories and unlock rules (migration 0009) and checks
// them before anything is equipped or used.

export const CATEGORIES = [
  "ring", "banner", "nameplate", "theme", "effect", "badge", "layout", "collection", "draft", "dashboard",
  "feed", "hub", "reaction", "insight", "chat", "sound", "planner", "milestone", "lab", "hubview",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const MILESTONES = [
  "first_night", "first_collection", "creators_mark", "midnight_milestone", "ink_explorer", "digital_pioneer",
  "music_enthusiast", "art_collector", "community_regular", "night_archivist", "creative_streak", "profile_builder",
  "discovery_journey", "collection_curator", "creator_milestone", "personal_archive", "seasonal_journey", "year_in_yoru",
  "legacy_display", "eternal_night",
] as const;
export type MilestoneKey = (typeof MILESTONES)[number];

// "staff:owner" = the founder only, "staff:admin" = admins and the founder,
// "staff:member:<profile id>" = one named member of staff (a personal set).
// Staff items identify real YORU staff; the server checks the account's role.
export type Unlock = "free" | "pro" | `milestone:${MilestoneKey}` | "staff:admin" | "staff:owner" | `staff:member:${string}`;
// "experimental" = works, opt-in, may change. Items that don't work yet are not in the catalog.
export type Status = "available" | "experimental";

export type SetId =
  | "crimson_requiem" | "void_signal" | "celestial_noir" | "neon_tokyo" | "ghost_frequency"
  | "sakura_after_dark" | "obsidian_dynasty" | "pixel_afterlife" | "inkstorm" | "infinite_night"
  | "midnight_essentials" | "night_studio" | "night_analyst" | "explorer_atlas" | "the_archive"
  | "signal_tuning" | "night_milestones" | "prototype_lab" | "membership"
  | "founders_throne" | "night_watch" | "cofounders_circuit";

export type Item<P = Record<string, unknown>> = {
  id: string;
  cat: Category;
  name: string;
  desc: string;
  rarity: Rarity;
  set: SetId;
  unlock: Unlock;
  status: Status;
  p: P;
};

// Equip slots: one item per slot. Public slots are shown to other members;
// personal slots only change what you see.
export const SLOTS = {
  ring: { cat: "ring", public: true },
  banner: { cat: "banner", public: true },
  nameplate: { cat: "nameplate", public: true },
  badge: { cat: "badge", public: true },
  layout: { cat: "layout", public: true },
  milestone: { cat: "milestone", public: true },
  theme: { cat: "theme", public: false },
  effect: { cat: "effect", public: false },
  reaction: { cat: "reaction", public: false },
  chat: { cat: "chat", public: false },
  sound: { cat: "sound", public: false },
  feed: { cat: "feed", public: false },
  dashboard: { cat: "dashboard", public: false },
  insight: { cat: "insight", public: false },
} as const satisfies Record<string, { cat: Category; public: boolean }>;
export type Slot = keyof typeof SLOTS;

export function slotFor(cat: Category): Slot | null {
  for (const [slot, s] of Object.entries(SLOTS)) if (s.cat === cat) return slot as Slot;
  return null;
}
