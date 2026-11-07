import { F, M, P, mk } from "./mk";

// 06 Badge Collection. Cosmetic badges shown next to your name. Paid and free
// badges are labelled as cosmetics; the ones unlocked by a milestone say
// "Earned" and can't be bought. Achievements (awards from activity) stay separate.
export type BadgeP = {
  shape: "seal" | "shield" | "star" | "crest" | "coin" | "gem" | "lotus" | "heart" | "hex" | "orbit" | "shard" | "moon" | "flower" | "token" | "prism" | "chip";
  glyph: string;
  a: string;
  b: string;
};
export const badges = mk<BadgeP>("badge", [
  ["Night One", "A small crescent coin: the first badge everyone can wear.", "C", "midnight_essentials", F, { shape: "coin", glyph: "一", a: "#f5f5f5", b: "#e5102f" }],
  ["Crimson Seal", "A hand-pressed red hanko seal with 紅.", "R", "crimson_requiem", P, { shape: "seal", glyph: "紅", a: "#e5102f", b: "#2a0207" }],
  ["Void Emblem", "A violet hexagon with a glitched void at its centre.", "R", "void_signal", P, { shape: "hex", glyph: "◈", a: "#7c5cff", b: "#2ee6ff" }],
  ["Neon Crest", "A shield of neon tubes in pink and cyan.", "E", "neon_tokyo", P, { shape: "crest", glyph: "⚡", a: "#ff2bd6", b: "#28f0ff" }],
  ["Moon Sigil", "A silver sigil framing a full moon.", "R", "celestial_noir", P, { shape: "moon", glyph: "☾", a: "#d8dde6", b: "#5b6474" }],
  ["Phantom Mark", "A pale ghost-mark that fades in at the edges.", "U", "ghost_frequency", M("midnight_milestone"), { shape: "shield", glyph: "◌", a: "#e5e5e5", b: "#5c5c5c" }],
  ["Ink Seal", "A paper tag stamped with a black 墨 brush seal.", "U", "inkstorm", P, { shape: "seal", glyph: "墨", a: "#0a0a0a", b: "#f4f2ee" }],
  ["Scarlet Star", "A five-point scarlet star with an ink outline.", "R", "crimson_requiem", M("creators_mark"), { shape: "star", glyph: "★", a: "#ff3b4e", b: "#3a0710" }],
  ["Digital Bloom", "A pixel flower opening in arcade green and yellow.", "R", "pixel_afterlife", P, { shape: "flower", glyph: "✿", a: "#39ff88", b: "#ffd23f" }],
  ["Eclipse Token", "A black coin rimmed with a thin corona.", "E", "infinite_night", P, { shape: "token", glyph: "●", a: "#0a0a0a", b: "#c9d1ff" }],
  ["Silver Orbit", "A silver dot on a tilted orbit. Free for everyone.", "C", "celestial_noir", F, { shape: "orbit", glyph: "∘", a: "#e6ebf2", b: "#8a93a3" }],
  ["Black Lotus", "A black lotus edged in rose.", "E", "sakura_after_dark", P, { shape: "lotus", glyph: "❀", a: "#1a0c14", b: "#ff8fb4" }],
  ["Ghost Icon", "A tiny monochrome ghost behind static.", "U", "ghost_frequency", P, { shape: "shield", glyph: "👻", a: "#d9d9d9", b: "#262626" }],
  ["Celestial Shard", "A crystal shard holding a single star.", "E", "infinite_night", M("collection_curator"), { shape: "shard", glyph: "✦", a: "#e9e6ff", b: "#5b6cff" }],
  ["Static Heart", "A heart drawn in soft static. Free for everyone.", "C", "ghost_frequency", F, { shape: "heart", glyph: "♥", a: "#f0f0f0", b: "#6b6b6b" }],
  ["Midnight Crest", "A simple crest in YORU red and white. Free for everyone.", "U", "midnight_essentials", F, { shape: "crest", glyph: "夜", a: "#e5102f", b: "#f5f5f5" }],
  ["Prism Mark", "A triangular prism splitting light into colour.", "R", "void_signal", P, { shape: "prism", glyph: "△", a: "#ffffff", b: "#7c5cff" }],
  ["Obsidian Sigil", "Polished black gem set in gold.", "L", "obsidian_dynasty", P, { shape: "gem", glyph: "♛", a: "#121212", b: "#e0b54f" }],
  ["Afterdark Token", "A crimson-to-gold coin stamped 夜.", "E", "crimson_requiem", P, { shape: "token", glyph: "夜", a: "#e5102f", b: "#f3c45a" }],
  ["Yoru Pro Emblem", "The Pro emblem: the YORU moon on a starfield shield.", "L", "infinite_night", P, { shape: "crest", glyph: "☾", a: "#5b6cff", b: "#f3e2a9" }],
]);

// 07 Advanced Profile Layouts. Each preset arranges sections the profile page
// already has. `order` lists them top to bottom; unknown or empty sections are
// skipped, so a layout never shows something the member hasn't filled in.
export const PROFILE_SECTIONS = ["stats", "xp", "showcase", "interests", "achievements", "jokes", "timeline", "collections", "pinned", "tabs"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];
export type LayoutP = {
  order: ProfileSection[];
  header: "full" | "tall" | "compact" | "cinematic";
  posts: "list" | "grid";
  stats: "tiles" | "inline";
  frame: "none" | "panel" | "terminal" | "editorial" | "scrapbook" | "neon" | "magazine" | "gallery";
  tab?: "user" | "media" | "collections";
  custom?: boolean;
};
const ALL: ProfileSection[] = ["stats", "xp", "showcase", "interests", "achievements", "jokes", "pinned", "tabs"];
export const layouts = mk<LayoutP>("layout", [
  ["The Minimalist", "Name, bio and posts. Everything else tucked away.", "C", "midnight_essentials", F, { order: ["stats", "pinned", "tabs"], header: "compact", posts: "list", stats: "inline", frame: "none" }],
  ["Manga Panels", "Sections boxed as inked manga panels, posts in a panel grid.", "E", "inkstorm", P, { order: ["showcase", "stats", "pinned", "interests", "tabs"], header: "full", posts: "grid", stats: "tiles", frame: "panel" }],
  ["Creator Spotlight", "Pinned post first, then your showcase and the feed.", "R", "night_studio", P, { order: ["pinned", "showcase", "stats", "interests", "tabs"], header: "tall", posts: "list", stats: "tiles", frame: "none" }],
  ["Gallery Wall", "Opens on your media grid, like a wall of frames.", "R", "the_archive", P, { order: ["stats", "tabs"], header: "compact", posts: "grid", stats: "inline", frame: "gallery", tab: "media" }],
  ["Midnight Editorial", "Serif headings and generous spacing, like a magazine feature.", "E", "celestial_noir", P, { order: ["pinned", "interests", "showcase", "stats", "tabs"], header: "cinematic", posts: "list", stats: "inline", frame: "editorial" }],
  ["Neon Grid", "Glowing section edges and a media grid.", "R", "neon_tokyo", P, { order: ["stats", "showcase", "interests", "tabs"], header: "full", posts: "grid", stats: "tiles", frame: "neon" }],
  ["Compact Profile", "Everything in a short header so posts start sooner.", "C", "midnight_essentials", F, { order: ["stats", "interests", "tabs"], header: "compact", posts: "list", stats: "inline", frame: "none" }],
  ["Cinematic Header", "An extra-tall banner that leads into your profile.", "E", "infinite_night", P, { order: ALL, header: "cinematic", posts: "list", stats: "tiles", frame: "none" }],
  ["Collection Showcase", "Your public collections first, then the feed.", "R", "the_archive", M("first_collection"), { order: ["collections", "stats", "pinned", "tabs"], header: "full", posts: "list", stats: "inline", frame: "none" }],
  ["Featured Post", "Your pinned post sits right under your name.", "U", "midnight_essentials", F, { order: ["pinned", "stats", "xp", "showcase", "tabs"], header: "full", posts: "list", stats: "tiles", frame: "none" }],
  ["Music Identity", "Interests and your current listen lead the page.", "R", "neon_tokyo", P, { order: ["interests", "pinned", "stats", "tabs"], header: "tall", posts: "list", stats: "inline", frame: "none" }],
  ["Anime Archive", "Collections and interests up front, framed in panels.", "E", "inkstorm", P, { order: ["interests", "collections", "showcase", "tabs"], header: "full", posts: "grid", stats: "inline", frame: "panel" }],
  ["Monochrome Portfolio", "Media grid in a quiet, colourless frame.", "R", "ghost_frequency", P, { order: ["stats", "tabs"], header: "compact", posts: "grid", stats: "inline", frame: "gallery", tab: "media" }],
  ["Crimson Magazine", "Bold red section rules and a cover-style header.", "E", "crimson_requiem", P, { order: ["pinned", "showcase", "stats", "interests", "achievements", "tabs"], header: "cinematic", posts: "list", stats: "tiles", frame: "magazine" }],
  ["The Scrapbook", "Slightly tilted cards, tape corners, achievements on show.", "R", "sakura_after_dark", M("personal_archive"), { order: ["showcase", "achievements", "jokes", "pinned", "tabs"], header: "full", posts: "list", stats: "tiles", frame: "scrapbook" }],
  ["Digital Terminal", "Monospace sections in a terminal frame.", "R", "pixel_afterlife", P, { order: ["stats", "xp", "achievements", "tabs"], header: "compact", posts: "list", stats: "inline", frame: "terminal" }],
  ["Artwork First", "Media tab open by default, large grid.", "U", "night_studio", P, { order: ["pinned", "tabs"], header: "tall", posts: "grid", stats: "inline", frame: "none", tab: "media" }],
  ["Timeline Focus", "Your milestone timeline right under your name.", "U", "night_milestones", F, { order: ["timeline", "stats", "pinned", "tabs"], header: "full", posts: "list", stats: "inline", frame: "none" }],
  ["The Collector", "Badges, milestones and collections, in that order.", "E", "night_milestones", M("collection_curator"), { order: ["showcase", "timeline", "collections", "achievements", "tabs"], header: "full", posts: "list", stats: "tiles", frame: "none" }],
  ["Custom Canvas", "Arrange every section yourself, in any order.", "L", "membership", P, { order: ALL, header: "full", posts: "list", stats: "tiles", frame: "none", custom: true }],
]);

// 13 Reaction Cosmetics. Only the burst you see when you react changes. The
// reaction itself, its meaning, its count and its limits are untouched, and
// nobody else's feed ranks it differently.
export type ReactionP = {
  burst: "ring" | "impact" | "heart" | "pixel" | "pulse" | "glitch" | "splash" | "shine" | "shock" | "petals" | "flame" | "prism" | "stars" | "digital" | "orbit" | "shimmer" | "ripple" | "comic" | "trail" | "burst";
  colors: string[];
  count: number;
  text?: string;
};
export const reactions = mk<ReactionP>("reaction", [
  ["Crimson Burst", "A ring of crimson sparks. Free for everyone.", "C", "crimson_requiem", F, { burst: "burst", colors: ["#e5102f", "#ff6b81"], count: 10 }],
  ["Manga Impact", "An inked impact star with ドン in the middle.", "E", "inkstorm", P, { burst: "impact", colors: ["#ffffff", "#0a0a0a"], count: 12, text: "ドン" }],
  ["Neon Heart", "A neon-tube heart that glows and fades.", "R", "neon_tokyo", P, { burst: "heart", colors: ["#ff2bd6", "#28f0ff"], count: 1 }],
  ["Pixel Spark", "Square pixel sparks popping outward.", "U", "pixel_afterlife", P, { burst: "pixel", colors: ["#39ff88", "#ffd23f"], count: 12 }],
  ["Moonlight Pulse", "A soft silver pulse. Free for everyone.", "C", "celestial_noir", F, { burst: "pulse", colors: ["#e6ebf2"], count: 2 }],
  ["Glitch Pop", "The emoji splits into RGB copies for a moment.", "R", "void_signal", P, { burst: "glitch", colors: ["#2ee6ff", "#ff3b6b"], count: 3 }],
  ["Ink Splash", "Black ink drops splash out. Free for everyone.", "U", "inkstorm", F, { burst: "splash", colors: ["#0a0a0a", "#3a3a3a"], count: 9 }],
  ["Celestial Shine", "A four-point star glint.", "R", "celestial_noir", P, { burst: "shine", colors: ["#ffffff", "#c9d1e0"], count: 4 }],
  ["Electric Shock", "Short zig-zag bolts around the button.", "E", "neon_tokyo", P, { burst: "shock", colors: ["#7fc3ff", "#ffffff"], count: 6 }],
  ["Sakura Bloom", "A handful of petals drifting out.", "R", "sakura_after_dark", M("art_collector"), { burst: "petals", colors: ["#ff9ec0", "#ffd0e0"], count: 8 }],
  ["Ghost Flame", "Pale flames flicker up and vanish.", "E", "ghost_frequency", P, { burst: "flame", colors: ["#e5e5e5", "#8fd8ff"], count: 5 }],
  ["Prism Flash", "A slow rainbow ring (no strobing).", "L", "void_signal", P, { burst: "prism", colors: ["#ff2bd6", "#ffd23f", "#2ee6ff", "#7c5cff"], count: 8 }],
  ["Star Explosion", "Tiny stars thrown outward.", "E", "infinite_night", M("creative_streak"), { burst: "stars", colors: ["#fff6d6", "#e9e6ff"], count: 12 }],
  ["Digital Heart", "A pixel heart assembling itself.", "R", "pixel_afterlife", P, { burst: "digital", colors: ["#ff3b6b", "#ffd23f"], count: 1 }],
  ["Scarlet Orbit", "Two scarlet dots orbit once and fade.", "R", "crimson_requiem", P, { burst: "orbit", colors: ["#ff3b4e", "#ffb36b"], count: 2 }],
  ["Silver Shimmer", "A light sweep across the button.", "U", "obsidian_dynasty", P, { burst: "shimmer", colors: ["#f3e2a9", "#ffffff"], count: 1 }],
  ["Void Ripple", "Concentric violet ripples.", "E", "void_signal", P, { burst: "ripple", colors: ["#7c5cff", "#2a1d55"], count: 3 }],
  ["Comic Pop", "A comic POW! bubble. Free for everyone.", "U", "inkstorm", F, { burst: "comic", colors: ["#ffd23f", "#0a0a0a"], count: 1, text: "POW!" }],
  ["Phantom Trail", "The emoji rises leaving faint echoes.", "R", "ghost_frequency", M("night_archivist"), { burst: "trail", colors: ["#ffffff"], count: 4 }],
  ["Midnight Burst", "A deep blue and gold firework.", "L", "infinite_night", P, { burst: "burst", colors: ["#5b6cff", "#f3e2a9", "#ffffff"], count: 16 }],
]);

// 15 Chat Personalization. Only changes how conversations look to you: the
// background, bubble colours and accent. Delivery, read states, blocking,
// reporting and privacy are untouched. Bubble text contrast is tested (≥ 4.5:1).
export type ChatP = {
  bg: string;
  pattern: "none" | "static" | "grid" | "petals" | "lines" | "stars" | "rain" | "smoke" | "pixel" | "mist" | "glass" | "moon" | "lotus" | "dust" | "torii";
  me: string;
  meInk: string;
  them: string;
  themInk: string;
  accent: string;
};
export const chats = mk<ChatP>("chat", [
  ["Crimson Static", "Black with faint red static; your messages in YORU red.", "C", "crimson_requiem", F, { bg: "#0b0405", pattern: "static", me: "#c40d29", meInk: "#ffffff", them: "#1d1012", themInk: "#f7e9eb", accent: "#e5102f" }],
  ["Midnight Blue", "Deep navy with soft blue bubbles. Free for everyone.", "C", "midnight_essentials", F, { bg: "#050914", pattern: "none", me: "#2353c9", meInk: "#ffffff", them: "#121a2e", themInk: "#e8eeff", accent: "#4d7cff" }],
  ["Violet Void", "Violet black with a slow void grid.", "R", "void_signal", P, { bg: "#07050d", pattern: "grid", me: "#5b3fd6", meInk: "#ffffff", them: "#16112a", themInk: "#ece6ff", accent: "#7c5cff" }],
  ["Sakura Night", "Plum night with a few drifting petals.", "R", "sakura_after_dark", P, { bg: "#0d0710", pattern: "petals", me: "#b8336a", meInk: "#ffffff", them: "#1f1320", themInk: "#ffeaf3", accent: "#ff8fb4" }],
  ["Monochrome Ink", "Paper white and ink black. Free for everyone.", "U", "inkstorm", F, { bg: "#f4f2ee", pattern: "lines", me: "#0a0a0a", meInk: "#ffffff", them: "#ffffff", themInk: "#0a0a0a", accent: "#0a0a0a" }],
  ["Neon Tokyo", "Night street glow with pink and cyan bubbles.", "E", "neon_tokyo", P, { bg: "#07040f", pattern: "rain", me: "#a3128a", meInk: "#ffffff", them: "#0d2230", themInk: "#dffbff", accent: "#ff2bd6" }],
  ["Silver Eclipse", "Graphite with a silver moon in the corner.", "R", "celestial_noir", P, { bg: "#08090b", pattern: "moon", me: "#3c4656", meInk: "#ffffff", them: "#171a20", themInk: "#eef2f7", accent: "#c9d1e0" }],
  ["Black Lotus", "Black with a faint lotus watermark and rose accents.", "E", "sakura_after_dark", P, { bg: "#080507", pattern: "lotus", me: "#8f2a55", meInk: "#ffffff", them: "#1a0f15", themInk: "#ffe8f1", accent: "#ff8fb4" }],
  ["Ghost Signal", "Flat greys with a soft scanline. Free for everyone.", "U", "ghost_frequency", F, { bg: "#0a0a0a", pattern: "static", me: "#4a4a4a", meInk: "#ffffff", them: "#1a1a1a", themInk: "#ededed", accent: "#bdbdbd" }],
  ["Digital Rain", "Terminal black with green glyph rain.", "R", "pixel_afterlife", P, { bg: "#030603", pattern: "rain", me: "#16733a", meInk: "#ffffff", them: "#0d1a0d", themInk: "#e3ffe3", accent: "#39ff88" }],
  ["Celestial Dust", "A dusting of stars across deep blue.", "R", "celestial_noir", M("seasonal_journey"), { bg: "#05060f", pattern: "dust", me: "#3a46a8", meInk: "#ffffff", them: "#13152a", themInk: "#ececff", accent: "#9aa7ff" }],
  ["Scarlet Smoke", "Red-black smoke curling at the bottom.", "E", "crimson_requiem", P, { bg: "#0a0304", pattern: "smoke", me: "#a50f26", meInk: "#ffffff", them: "#1f0d10", themInk: "#ffe9ec", accent: "#ff3b4e" }],
  ["Arcade Midnight", "Purple black with a pixel border and yellow bubbles.", "R", "pixel_afterlife", P, { bg: "#07050b", pattern: "pixel", me: "#ffd23f", meInk: "#14100a", them: "#1b1428", themInk: "#fffbe8", accent: "#ffd23f" }],
  ["Rose Quartz", "Soft rose glass over dark plum.", "U", "sakura_after_dark", P, { bg: "#110a0e", pattern: "glass", me: "#b04f78", meInk: "#ffffff", them: "#241820", themInk: "#ffeef5", accent: "#ffb3cf" }],
  ["Obsidian Glass", "Glossy black bubbles with gold edges.", "L", "obsidian_dynasty", P, { bg: "#050505", pattern: "glass", me: "#1a1a1a", meInk: "#f3e2a9", them: "#111111", themInk: "#f2f2f2", accent: "#e0b54f" }],
  ["Phantom Mist", "Pale mist drifting behind the conversation.", "R", "ghost_frequency", M("community_regular"), { bg: "#0b0c0d", pattern: "mist", me: "#56606b", meInk: "#ffffff", them: "#1b1e21", themInk: "#eef1f4", accent: "#d9d9d9" }],
  ["Electric Cyan", "Ice-dark with sharp cyan bubbles.", "R", "neon_tokyo", P, { bg: "#04080b", pattern: "grid", me: "#0b7a8f", meInk: "#ffffff", them: "#0e1b24", themInk: "#e3f9ff", accent: "#28f0ff" }],
  ["Moonlit Shrine", "A torii silhouette under a pale moon.", "E", "celestial_noir", M("year_in_yoru"), { bg: "#06070c", pattern: "torii", me: "#7a1626", meInk: "#ffffff", them: "#151823", themInk: "#eef1fa", accent: "#e5102f" }],
  ["Golden Hour", "Warm cream and gold. A light chat theme.", "R", "obsidian_dynasty", P, { bg: "#f7f1e6", pattern: "none", me: "#7a5a12", meInk: "#ffffff", them: "#ffffff", themInk: "#1a140a", accent: "#c8a24a" }],
  ["Infinite Night", "True black starfield with deep blue bubbles.", "L", "infinite_night", P, { bg: "#000000", pattern: "stars", me: "#2f3db3", meInk: "#ffffff", them: "#101018", themInk: "#f0f0ff", accent: "#5b6cff" }],
]);

// 18 Profile Evolution. Earned only, by doing the thing. Never sold, never
// granted for something a member didn't do. The database computes each one
// from the member's own records (migration 0009, `pro_milestones`).
export type MilestoneP = { key: string; emblem: string; a: string; b: string; rule: string; goal: number };
export const milestones = mk<MilestoneP>("milestone", [
  ["First Night", "Your first post on YORU.", "C", "night_milestones", M("first_night"), { key: "first_night", emblem: "☾", a: "#f5f5f5", b: "#e5102f", rule: "Publish your first post.", goal: 1 }],
  ["First Collection", "You started keeping things.", "C", "night_milestones", M("first_collection"), { key: "first_collection", emblem: "▤", a: "#d9a066", b: "#3a2610", rule: "Create your first collection.", goal: 1 }],
  ["Creator's Mark", "You told people what you make.", "U", "night_milestones", M("creators_mark"), { key: "creators_mark", emblem: "✎", a: "#ff6b3d", b: "#3a1408", rule: "Choose a creator category on your profile.", goal: 1 }],
  ["Midnight Milestone", "Seven nights in a row.", "U", "night_milestones", M("midnight_milestone"), { key: "midnight_milestone", emblem: "七", a: "#c9d1e0", b: "#1a1f2a", rule: "Reach a 7-night check-in streak.", goal: 7 }],
  ["Ink Explorer", "Five different tags in your own posts.", "U", "night_milestones", M("ink_explorer"), { key: "ink_explorer", emblem: "#", a: "#0a0a0a", b: "#f4f2ee", rule: "Use 5 different hashtags across your posts.", goal: 5 }],
  ["Digital Pioneer", "Three posts with images, GIFs or video.", "U", "night_milestones", M("digital_pioneer"), { key: "digital_pioneer", emblem: "▶", a: "#39ff88", b: "#0b2a17", rule: "Publish 3 posts with media.", goal: 3 }],
  ["Music Enthusiast", "Three posts tagged with music.", "R", "night_milestones", M("music_enthusiast"), { key: "music_enthusiast", emblem: "♪", a: "#ff2bd6", b: "#2a0624", rule: "Publish 3 posts tagged #music, #vocaloid, #jpop or #jrock.", goal: 3 }],
  ["Art Collector", "Ten images saved into your collections.", "R", "night_milestones", M("art_collector"), { key: "art_collector", emblem: "❖", a: "#ff8fb4", b: "#3a1424", rule: "Save 10 image posts into your collections.", goal: 10 }],
  ["Community Regular", "Twenty-five comments on other people's posts.", "R", "night_milestones", M("community_regular"), { key: "community_regular", emblem: "💬", a: "#3d8bff", b: "#0a1a33", rule: "Comment on other members' posts 25 times.", goal: 25 }],
  ["Night Archivist", "Twenty-five bookmarks.", "R", "night_milestones", M("night_archivist"), { key: "night_archivist", emblem: "⌘", a: "#a3a3a3", b: "#1f1f1f", rule: "Bookmark 25 posts.", goal: 25 }],
  ["Creative Streak", "Posts on seven different days.", "R", "night_milestones", M("creative_streak"), { key: "creative_streak", emblem: "✷", a: "#e5102f", b: "#2a0207", rule: "Publish posts on 7 different days.", goal: 7 }],
  ["Profile Builder", "A photo, a bio and an interest.", "C", "night_milestones", M("profile_builder"), { key: "profile_builder", emblem: "◐", a: "#7c5cff", b: "#1a1033", rule: "Add a profile photo, a bio and at least one interest.", goal: 3 }],
  ["Discovery Journey", "You found ten people worth reacting to.", "U", "night_milestones", M("discovery_journey"), { key: "discovery_journey", emblem: "⌖", a: "#2ee6ff", b: "#062a30", rule: "React to posts by 10 different members.", goal: 10 }],
  ["Collection Curator", "Three collections with five things each.", "E", "night_milestones", M("collection_curator"), { key: "collection_curator", emblem: "▦", a: "#e0b54f", b: "#2a1f08", rule: "Have 3 collections with at least 5 items each.", goal: 3 }],
  ["Creator Milestone", "A hundred reactions on your posts.", "E", "night_milestones", M("creator_milestone"), { key: "creator_milestone", emblem: "百", a: "#ff3b4e", b: "#3a0710", rule: "Receive 100 reactions across your posts.", goal: 100 }],
  ["Personal Archive", "Fifty posts.", "E", "night_milestones", M("personal_archive"), { key: "personal_archive", emblem: "五十", a: "#f4f2ee", b: "#0a0a0a", rule: "Publish 50 posts.", goal: 50 }],
  ["Seasonal Journey", "Posts in three different months.", "R", "night_milestones", M("seasonal_journey"), { key: "seasonal_journey", emblem: "❄", a: "#39ffb0", b: "#06261c", rule: "Publish posts in 3 different calendar months.", goal: 3 }],
  ["Year in YORU", "One year since you joined, and still posting.", "E", "night_milestones", M("year_in_yoru"), { key: "year_in_yoru", emblem: "一年", a: "#f5b301", b: "#2a1f00", rule: "Be a member for a year and post during that year.", goal: 365 }],
  ["Legacy Display", "Ten milestones earned.", "L", "night_milestones", M("legacy_display"), { key: "legacy_display", emblem: "✪", a: "#e9e6ff", b: "#2a2a6a", rule: "Earn 10 other milestones.", goal: 10 }],
  ["Eternal Night", "Every other milestone, earned.", "L", "night_milestones", M("eternal_night"), { key: "eternal_night", emblem: "夜", a: "#5b6cff", b: "#f3e2a9", rule: "Earn all 19 other milestones.", goal: 19 }],
]);
