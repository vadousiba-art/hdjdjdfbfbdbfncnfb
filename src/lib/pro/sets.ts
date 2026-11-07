import type { SetId } from "./types";
import { JESSE } from "./catalog/staff";

// Named collections. Each has its own identity, palette and cover; items in a
// set are designed to be worn together (the "signature look" bundles).
export type CosmeticSet = {
  id: SetId;
  name: string;
  jp: string;
  tagline: string;
  palette: [string, string, string]; // base, accent, highlight
  cover: "impact" | "glitch" | "moon" | "signage" | "static" | "petals" | "gilded" | "pixel" | "brush" | "stars" | "plain" | "desk" | "chart" | "map" | "shelf" | "wave" | "trophy" | "flask" | "door" | "throne" | "watch" | "circuit";
  staff?: "owner" | "admin" | "member"; // reserved sets, hidden from members
  member?: string; // for staff: "member", the one profile id that can wear it
  look?: { ring: string; banner: string; nameplate: string; badge: string; theme: string }; // signature bundle (item ids)
};

export const SETS: CosmeticSet[] = [
  { id: "crimson_requiem", name: "Crimson Requiem", jp: "紅の鎮魂歌", tagline: "Red-black manga impacts, fractured rings, ink splashes.", palette: ["#0b0204", "#e5102f", "#ff6b81"], cover: "impact",
    look: { ring: "ring.crimson_eclipse", banner: "banner.crimson_rain", nameplate: "nameplate.crimson_phantom", badge: "badge.crimson_seal", theme: "theme.crimson_night" } },
  { id: "void_signal", name: "Void Signal", jp: "虚無の信号", tagline: "Glitch effects, digital distortion, dark futuristic frames.", palette: ["#05060a", "#7c5cff", "#2ee6ff"], cover: "glitch",
    look: { ring: "ring.glitch_transmission", banner: "banner.digital_abyss", nameplate: "nameplate.digital_ghost", badge: "badge.void_emblem", theme: "theme.violet_abyss" } },
  { id: "celestial_noir", name: "Celestial Noir", jp: "天体の夜", tagline: "Silver halos, moonlight, stars, elegant night themes.", palette: ["#06070c", "#c9d1e0", "#ffffff"], cover: "moon",
    look: { ring: "ring.silver_moon", banner: "banner.moonlit_shrine", nameplate: "nameplate.lunar_outcast", badge: "badge.moon_sigil", theme: "theme.silver_eclipse" } },
  { id: "neon_tokyo", name: "Neon Tokyo", jp: "ネオン東京", tagline: "Electric signage, futuristic cityscapes, vibrant accents.", palette: ["#07040f", "#ff2bd6", "#28f0ff"], cover: "signage",
    look: { ring: "ring.neon_circuit", banner: "banner.neon_tokyo", nameplate: "nameplate.neon_drifter", badge: "badge.neon_crest", theme: "theme.electric_tokyo" } },
  { id: "ghost_frequency", name: "Ghost Frequency", jp: "幽霊周波数", tagline: "Spectral trails, static, mysterious monochrome effects.", palette: ["#070707", "#d9d9d9", "#8a8a8a"], cover: "static",
    look: { ring: "ring.ghost_signal", banner: "banner.the_empty_station", nameplate: "nameplate.silent_signal", badge: "badge.ghost_icon", theme: "theme.ghost_protocol" } },
  { id: "sakura_after_dark", name: "Sakura After Dark", jp: "夜桜", tagline: "Restrained cherry blossoms, deep violet, rose and black.", palette: ["#0d0710", "#ff8fb4", "#ffd3e2"], cover: "petals",
    look: { ring: "ring.scarlet_roses", banner: "banner.violet_static", nameplate: "nameplate.velvet_nightmare", badge: "badge.black_lotus", theme: "theme.sakura_after_dark" } },
  { id: "obsidian_dynasty", name: "Obsidian Dynasty", jp: "黒曜の王朝", tagline: "Polished black, metallic detailing, elegant nameplates.", palette: ["#050505", "#c8a24a", "#f3e2a9"], cover: "gilded",
    look: { ring: "ring.obsidian_crown", banner: "banner.blackout", nameplate: "nameplate.obsidian_soul", badge: "badge.obsidian_sigil", theme: "theme.golden_hour" } },
  { id: "pixel_afterlife", name: "Pixel Afterlife", jp: "ピクセル来世", tagline: "Retro digital effects and arcade-inspired cosmetics.", palette: ["#08060f", "#39ff88", "#ffd23f"], cover: "pixel",
    look: { ring: "ring.digital_rain", banner: "banner.cyber_alley", nameplate: "nameplate.chaos_poet", badge: "badge.digital_bloom", theme: "theme.arcade_midnight" } },
  { id: "inkstorm", name: "Inkstorm", jp: "墨の嵐", tagline: "Hand-drawn manga marks, brushstrokes, speed lines.", palette: ["#f4f2ee", "#0a0a0a", "#e5102f"], cover: "brush",
    look: { ring: "ring.ink_explosion", banner: "banner.manga_impact", nameplate: "nameplate.ink_sovereign", badge: "badge.ink_seal", theme: "theme.monochrome_ink" } },
  { id: "infinite_night", name: "Infinite Night", jp: "永遠の夜", tagline: "Premium celestial effects and sophisticated dark designs.", palette: ["#03030a", "#5b6cff", "#e9e6ff"], cover: "stars",
    look: { ring: "ring.infinite_night", banner: "banner.infinite_nightfall", nameplate: "nameplate.yoru_eternal", badge: "badge.yoru_pro_emblem", theme: "theme.infinite_black" } },
  { id: "midnight_essentials", name: "Midnight Essentials", jp: "真夜中の基本", tagline: "Clean everyday pieces, free for every member.", palette: ["#0a0a0a", "#e5102f", "#f5f5f5"], cover: "plain" },
  { id: "night_studio", name: "Night Studio", jp: "夜のスタジオ", tagline: "Draft templates and planning tools for people who make things.", palette: ["#0b0b0f", "#ff6b3d", "#ffe0d1"], cover: "desk" },
  { id: "night_analyst", name: "Night Analyst", jp: "夜の分析", tagline: "Dashboards and insight layouts built on your real numbers.", palette: ["#05080b", "#2ee6a8", "#d1fff0"], cover: "chart" },
  { id: "explorer_atlas", name: "Explorer's Atlas", jp: "探索者の地図", tagline: "Feed presets and interest hubs for finding your corner.", palette: ["#060812", "#3d8bff", "#d6e6ff"], cover: "map" },
  { id: "the_archive", name: "The Archive", jp: "保管庫", tagline: "Collection templates for everything you want to keep.", palette: ["#0a0806", "#d9a066", "#fff1e0"], cover: "shelf" },
  { id: "signal_tuning", name: "Signal Tuning", jp: "信号調整", tagline: "Original notification sounds, synthesized for YORU.", palette: ["#07070c", "#a78bfa", "#ede9fe"], cover: "wave" },
  { id: "night_milestones", name: "Milestones of the Night", jp: "夜の節目", tagline: "Earned by doing, never sold. Your timeline on YORU.", palette: ["#080604", "#f5b301", "#fff4cc"], cover: "trophy" },
  { id: "prototype_lab", name: "Prototype Lab", jp: "試作室", tagline: "Opt-in previews and experiments. Clearly labelled, easy to turn off.", palette: ["#040a08", "#00e0a4", "#ccfff0"], cover: "flask" },
  { id: "membership", name: "Membership Hub", jp: "会員ハブ", tagline: "Your membership, your collection, your settings.", palette: ["#0a0a0a", "#e5102f", "#ffffff"], cover: "door" },
];

// Reserved for YORU staff. They mark who runs YORU, so the server only lets
// the founder (owner), admins, or the one named member wear them, and they
// never appear in the shop for anyone else.
export const STAFF_SETS: CosmeticSet[] = [
  { id: "founders_throne", name: "Founder's Throne", jp: "創設者の玉座", tagline: "Worn only by YORU's founder.", palette: ["#050403", "#e0b54f", "#e5102f"], cover: "throne", staff: "owner",
    look: { ring: "ring.founders_eclipse", banner: "banner.throne_of_night", nameplate: "nameplate.founder", badge: "badge.founders_seal", theme: "theme.founders_night" } },
  { id: "night_watch", name: "Night Watch", jp: "夜警", tagline: "Worn only by YORU admins.", palette: ["#03080d", "#2ee6ff", "#e9f8ff"], cover: "watch", staff: "admin",
    look: { ring: "ring.sentinel", banner: "banner.the_night_watch", nameplate: "nameplate.yoru_staff", badge: "badge.staff_shield", theme: "theme.watchtower" } },
  { id: "cofounders_circuit", name: "Co-Founder's Circuit", jp: "共同創設者の回路", tagline: "Worn only by Jesse, YORU's co-founder.", palette: ["#06040c", "#ffd60a", "#8b5cff"], cover: "circuit", staff: "member", member: JESSE,
    look: { ring: "ring.live_wire", banner: "banner.high_voltage", nameplate: "nameplate.co_founder", badge: "badge.co_founders_chip", theme: "theme.circuit_night" } },
];
export const SET_BY_ID = Object.fromEntries([...SETS, ...STAFF_SETS].map((s) => [s.id, s])) as Record<string, CosmeticSet>;
