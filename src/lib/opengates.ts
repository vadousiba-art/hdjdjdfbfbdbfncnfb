// Open Gates catalogue shared by the API validation and the UI. The database
// (migration 0007) enforces the same lists.
export const LOCALE_CODES = ["en", "ja", "fr", "es", "pt", "de", "ko", "zh-Hans", "zh-Hant", "id", "th", "vi", "it", "nl", "ru", "ar"] as const;
export const INTERESTS = ["anime", "manga", "gaming", "vocaloid", "jpop", "jrock", "art", "cosplay", "music", "writing", "film", "tech", "memes", "fashion", "food", "travel", "vtubers", "figures"] as const;
export const CREATOR_CATEGORIES = ["artist", "writer", "cosplayer", "musician", "video", "streamer", "developer"] as const;
export const BANNER_STYLES = ["aurora", "ink", "minimal", "sakura_night", "crimson_moon", "manga_panel"] as const;
export const PRO_BANNERS: readonly string[] = ["sakura_night", "crimson_moon", "manga_panel"];
export const AVATAR_FRAMES = ["none", "ring", "neon", "hanko"] as const;
export const PRO_FRAMES: readonly string[] = ["neon", "hanko"];
export const REPORT_CATEGORIES = ["harassment", "hate", "privacy", "spam", "explicit", "impersonation", "self_harm", "other"] as const;

export type Interest = (typeof INTERESTS)[number];
export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];
export type BannerStyle = (typeof BANNER_STYLES)[number];
export type AvatarFrame = (typeof AVATAR_FRAMES)[number];
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const INTEREST_EMOJI: Record<Interest, string> = {
  anime: "🌸", manga: "📖", gaming: "🎮", vocaloid: "🎤", jpop: "🎶", jrock: "🎸", art: "🎨", cosplay: "🎭",
  music: "🎧", writing: "✍️", film: "🎬", tech: "💻", memes: "🐸", fashion: "👘", food: "🍜", travel: "🗾",
  vtubers: "📺", figures: "🗿",
};

export type CollectionSummary = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  visibility: "private" | "members";
  count: number;
  cover: string | null;
  is_mine: boolean;
  has_post?: boolean;
  template?: string | null;
  sort?: "added_desc" | "added_asc" | "popular";
  updated_at: string;
  owner: { username: string; display_name: string };
};

export type ProfileIdentity = {
  interests: Interest[];
  banner_style: BannerStyle;
  avatar_frame: AvatarFrame;
  showcase_badges: string[];
  creator_category: CreatorCategory | null;
  creator_since: string | null;
  pro: boolean;
  ghost_mode: boolean | null;
  collections: CollectionSummary[];
  // Pro Universe (migration 0009): effective public slots and the milestone timeline.
  look?: { ring?: string; banner?: string; nameplate?: string; badge?: string; layout?: string; milestone?: string; layout_order?: string[] };
  timeline?: { key: string; earned_at: string }[];
};
