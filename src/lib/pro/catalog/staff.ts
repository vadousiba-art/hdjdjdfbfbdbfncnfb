import { mk } from "./mk";
import type { BannerP, EffectP, NameplateP, RingP, ThemeP } from "./cosmetics-a";
import type { BadgeP, ChatP, ReactionP } from "./cosmetics-b";
import type { Unlock } from "../types";

// Staff cosmetics: the most elaborate pieces in YORU, reserved for the people
// who run it. "staff:owner" = the founder, "staff:admin" = admins (and the
// founder), "staff:member:<id>" = one person's own set. The database checks
// the account (and its role) before they can be worn, and they disappear on
// their own if the role is removed.
const O: Unlock = "staff:owner";
const A: Unlock = "staff:admin";

// Jesse (@Jeskov007), YORU's co-founder: an electrician and a developer, so
// his set is built from live current and code.
export const JESSE = "69c19776-57af-4fed-bcae-445d00893627";
const J: Unlock = `staff:member:${JESSE}`;
const VOLT = "#ffd60a";
const VIOLET = "#8b5cff";
const HOT = "#fffbe0";

export const staffRings = mk<RingP>("ring", [
  ["Founder's Eclipse", "Gold light rays, a turning ring of runes that spell YORU, a crimson moon in orbit and a crowned crest.", "L", "founders_throne", O, { style: "founder", a: "#e0b54f", b: "#e5102f", anim: "spin" }],
  ["Sentinel", "A radar sweep, rotating shield plates and a watch-pulse that rings outward. For YORU admins.", "L", "night_watch", A, { style: "sentinel", a: "#2ee6ff", b: "#0b2a3a", anim: "spin" }],
]);
export const staffBanners = mk<BannerP>("banner", [
  ["Throne of Night", "A crimson-gold moon behind the founder's throne, searchlights crossing the sky, curtains swaying, embers rising.", "L", "founders_throne", O, { scene: "throne", anim: true }],
  ["The Night Watch", "A watchtower over the city, its radar sweeping, a beacon blinking and patrol lights crossing the grid.", "L", "night_watch", A, { scene: "watch", anim: true }],
]);
export const staffNameplates = mk<NameplateP>("nameplate", [
  ["Founder", "Gilded FOUNDER lettering with a turning crown and a slow light sweep.", "L", "founders_throne", O, { title: "Founder · 創設者", font: "display", fx: "founder", a: "#f3e2a9", b: "#e5102f", emblem: "♛", border: "double" }],
  ["YORU Staff", "A cyan staff plate with a scanning line and a shield.", "L", "night_watch", A, { title: "YORU Staff · 管理", font: "mono", fx: "staff", a: "#2ee6ff", b: "#e9f8ff", emblem: "⛨", border: "line" }],
]);
export const staffBadges = mk<BadgeP>("badge", [
  ["Founder's Seal", "A gold crest stamped 創, the founder's mark.", "L", "founders_throne", O, { shape: "crest", glyph: "創", a: "#f3e2a9", b: "#3a0710" }],
  ["Staff Shield", "A cyan shield stamped 守, for the people who keep YORU safe.", "L", "night_watch", A, { shape: "shield", glyph: "守", a: "#2ee6ff", b: "#062a30" }],
]);
export const staffThemes = mk<ThemeP>("theme", [
  ["Founder's Night", "Black lacquer and gold, with a crimson accent.", "L", "founders_throne", O, { mode: "dark", bg: "#050403", bg2: "#090705", card: "#110d08", card2: "#1a140c", line: "#3a2c14", ink: "#fbf3df", ink2: "#e6d6b0", muted: "#b3a27a", hue: 42 }],
  ["Watchtower", "Deep navy with a watchful cyan.", "L", "night_watch", A, { mode: "dark", bg: "#03080d", bg2: "#050d14", card: "#0a151e", card2: "#0f1e2a", line: "#1d3445", ink: "#eaf9ff", ink2: "#c9e6f2", muted: "#8db0c2", hue: 188 }],
]);
export const staffEffects = mk<EffectP>("effect", [
  ["Founder's Aura", "Gold embers and slow stars rising at the edges of the screen.", "L", "founders_throne", O, { kind: "particles", shape: "spark", colors: ["#e0b54f", "#fff1c9", "#e5102f"], count: 30, speed: 0.5, dir: "up" }],
  ["Watch Scan", "A soft cyan scan line sweeping the screen now and then.", "L", "night_watch", A, { kind: "particles", shape: "line", colors: ["#2ee6ff", "#9ff3ff"], count: 3, speed: 0.4, dir: "down" }],
]);
export const staffReactions = mk<ReactionP>("reaction", [
  ["Founder's Crown", "Gold stars and a crimson burst.", "L", "founders_throne", O, { burst: "stars", colors: ["#e0b54f", "#fff1c9", "#e5102f"], count: 14 }],
  ["Sentinel Pulse", "Cyan rings pulsing outward.", "L", "night_watch", A, { burst: "ripple", colors: ["#2ee6ff", "#9ff3ff"], count: 3 }],
]);
export const staffChats = mk<ChatP>("chat", [
  ["Founder's Hall", "Black and gold, with stars.", "L", "founders_throne", O, { bg: "#050403", pattern: "stars", me: "#8a6a1c", meInk: "#ffffff", them: "#1a140c", themInk: "#fbf3df", accent: "#e0b54f" }],
  ["Watchtower Channel", "Navy with a faint scan grid.", "L", "night_watch", A, { bg: "#03080d", pattern: "grid", me: "#0b6f82", meInk: "#ffffff", them: "#0f1e2a", themInk: "#eaf9ff", accent: "#2ee6ff" }],
]);

// Role-based staff items (migration 0010).
export const STAFF_ROLE = [...staffRings, ...staffBanners, ...staffNameplates, ...staffBadges, ...staffThemes, ...staffEffects, ...staffReactions, ...staffChats];

// Personal staff sets (migration 0012 onward).
export const STAFF_MEMBER = [
  ...mk<RingP>("ring", [
    ["Live Wire", "A circuit board wired round the avatar with current racing down every trace, lightning arcing off the rim, JESKOV · 007 · CO-FOUNDER turning in a ring, two charged sparks in orbit, a pixel invader on top and a chip stamped 共 below.", "L", "cofounders_circuit", J, { style: "cofounder", a: VOLT, b: VIOLET, anim: "spin" }],
  ]),
  ...mk<BannerP>("banner", [
    ["High Voltage", "A storm over the grid: lightning strikes the pylon and lights the sky, current runs down the power lines and across the circuit-board ground, and a terminal types out the build.", "L", "cofounders_circuit", J, { scene: "voltage", anim: true }],
  ]),
  ...mk<NameplateP>("nameplate", [
    ["Co-Founder", "Charged CO-FOUNDER lettering: current sweeping through it, a crackling bolt and a spark running along the edge.", "L", "cofounders_circuit", J, { title: "Co-Founder · 共同創設者", font: "display", fx: "cofounder", a: VOLT, b: VIOLET, emblem: "⚡", border: "line" }],
  ]),
  ...mk<BadgeP>("badge", [
    ["Co-Founder's Chip", "A microchip stamped 共 (together), the co-founder's mark.", "L", "cofounders_circuit", J, { shape: "chip", glyph: "共", a: VOLT, b: "#1a0f3a" }],
  ]),
  ...mk<ThemeP>("theme", [
    ["Circuit Night", "Circuit-board violet black with a charged accent.", "L", "cofounders_circuit", J, { mode: "dark", bg: "#06040c", bg2: "#0a0714", card: "#110c1f", card2: "#191230", line: "#2d2350", ink: "#f5f1ff", ink2: "#dcd3f7", muted: "#a69bc9", hue: 266 }],
  ]),
  ...mk<EffectP>("effect", [
    ["Static Charge", "Little arcs of static crackling and drifting at the edges of the screen.", "L", "cofounders_circuit", J, { kind: "particles", shape: "arc", colors: [VOLT, VIOLET, HOT], count: 16, speed: 0.6, dir: "drift" }],
  ]),
  ...mk<ReactionP>("reaction", [
    ["Overload", "Yellow and violet bolts bursting from the button.", "L", "cofounders_circuit", J, { burst: "shock", colors: [VOLT, VIOLET, HOT], count: 12 }],
  ]),
  ...mk<ChatP>("chat", [
    ["Server Room", "Violet black with a circuit grid; your messages charged violet.", "L", "cofounders_circuit", J, { bg: "#06040c", pattern: "grid", me: "#5b3fd1", meInk: "#ffffff", them: "#191230", themInk: "#f5f1ff", accent: VOLT }],
  ]),
];

export const STAFF = [...STAFF_ROLE, ...STAFF_MEMBER];
