import { F, M, P, mk } from "./mk";

// 01 Profile Rings. `style` picks a distinct silhouette in RingArt; colours
// and motion refine it. Every ring keeps the face fully visible.
export type RingP = { style: string; a: string; b: string; anim: "none" | "spin" | "pulse" | "flicker" | "drift" };
export const rings = mk<RingP>("ring", [
  ["Crimson Eclipse", "A crimson corona with a dark moon sliding across it, turning slowly.", "R", "crimson_requiem", P, { style: "eclipse", a: "#e5102f", b: "#2a0207", anim: "spin" }],
  ["Void Halo", "A thin violet halo floating just off the avatar, with a soft inner glow.", "U", "void_signal", F, { style: "halo", a: "#7c5cff", b: "#1a1033", anim: "pulse" }],
  ["Neon Circuit", "Circuit traces with glowing nodes running around the frame.", "E", "neon_tokyo", P, { style: "circuit", a: "#28f0ff", b: "#ff2bd6", anim: "none" }],
  ["Broken Manga Panel", "A square manga panel border, cracked at one corner, inked by hand.", "R", "inkstorm", P, { style: "panel", a: "#f4f2ee", b: "#0a0a0a", anim: "none" }],
  ["Black Flame", "Black flames licking upward around the edge, lit from within in red.", "E", "crimson_requiem", P, { style: "flame", a: "#0a0a0a", b: "#e5102f", anim: "flicker" }],
  ["Celestial Orbit", "Two tilted orbits with a small moon and star tracing them.", "R", "celestial_noir", M("first_night"), { style: "orbit", a: "#c9d1e0", b: "#ffffff", anim: "spin" }],
  ["Scarlet Roses", "A wreath of stylised scarlet roses and thorned stems.", "E", "sakura_after_dark", P, { style: "roses", a: "#d1143a", b: "#2b0a12", anim: "none" }],
  ["Glitch Transmission", "A ring that slips out of alignment in short RGB-split bursts.", "E", "void_signal", P, { style: "glitch", a: "#2ee6ff", b: "#ff3b6b", anim: "flicker" }],
  ["Silver Moon", "A clean silver ring with a crescent moon resting at the top.", "C", "celestial_noir", F, { style: "crescent", a: "#d8dde6", b: "#8a93a3", anim: "none" }],
  ["Electric Azure", "A bright azure ring with a crackle of light at two points.", "U", "neon_tokyo", F, { style: "electric", a: "#2f8bff", b: "#bfe0ff", anim: "pulse" }],
  ["Ink Explosion", "Ink splatters bursting outward from the frame like an impact panel.", "R", "inkstorm", M("ink_explorer"), { style: "splatter", a: "#0a0a0a", b: "#e5102f", anim: "none" }],
  ["Holographic Prism", "A prismatic ring whose colours rotate like a holographic foil.", "L", "void_signal", P, { style: "prism", a: "#ffffff", b: "#7c5cff", anim: "spin" }],
  ["Midnight Chains", "Interlocking dark metal links with a single gold link at the top.", "R", "obsidian_dynasty", P, { style: "chains", a: "#3a3a3a", b: "#c8a24a", anim: "none" }],
  ["Phantom Mist", "A pale mist drifting around the avatar, never quite closing.", "U", "ghost_frequency", P, { style: "mist", a: "#d9d9d9", b: "#6b6b6b", anim: "drift" }],
  ["Digital Rain", "Columns of falling green glyphs framing the avatar.", "R", "pixel_afterlife", P, { style: "rain", a: "#39ff88", b: "#0b2a17", anim: "drift" }],
  ["Crimson Shards", "Sharp crimson glass shards orbiting in a broken circle.", "R", "crimson_requiem", M("creative_streak"), { style: "shards", a: "#e5102f", b: "#ff6b81", anim: "spin" }],
  ["Starfall", "A ring of tiny stars with one falling star streaking past.", "E", "celestial_noir", P, { style: "starfall", a: "#e9e6ff", b: "#5b6cff", anim: "drift" }],
  ["Obsidian Crown", "A polished black ring topped with a small gilded crown.", "L", "obsidian_dynasty", P, { style: "crown", a: "#111111", b: "#e0b54f", anim: "none" }],
  ["Ghost Signal", "A thin dashed grey ring, like a signal fading in and out.", "C", "ghost_frequency", F, { style: "dashed", a: "#a3a3a3", b: "#4a4a4a", anim: "pulse" }],
  ["Infinite Night", "A deep blue ring filled with slowly turning stars and a gold rim.", "L", "infinite_night", P, { style: "galaxy", a: "#5b6cff", b: "#e9e6ff", anim: "spin" }],
]);

// 02 Profile Banners. Each `scene` is its own composition in BannerArt.
export type BannerP = { scene: string; anim: boolean };
export const banners = mk<BannerP>("banner", [
  ["After Dark", "A dark gradient with a single crimson horizon line. The YORU essential.", "C", "midnight_essentials", F, { scene: "afterdark", anim: false }],
  ["Crimson Rain", "Crimson rain falling past a black skyline.", "R", "crimson_requiem", P, { scene: "crimson_rain", anim: true }],
  ["Neon Tokyo", "Layered neon signage over a wet street, with flickering kanji.", "E", "neon_tokyo", P, { scene: "neon_tokyo", anim: true }],
  ["The Empty Station", "A deserted platform under one buzzing light, monochrome.", "R", "ghost_frequency", P, { scene: "station", anim: false }],
  ["Midnight Skyline", "A quiet city skyline with lit windows under a navy sky.", "U", "midnight_essentials", F, { scene: "skyline", anim: false }],
  ["Manga Impact", "An inked impact frame: radial speed lines and a splash burst.", "E", "inkstorm", P, { scene: "impact", anim: false }],
  ["Digital Abyss", "A perspective grid falling into a violet void, slowly scrolling.", "E", "void_signal", P, { scene: "abyss", anim: true }],
  ["Moonlit Shrine", "A torii gate silhouetted against a huge pale moon.", "R", "celestial_noir", M("profile_builder"), { scene: "shrine", anim: false }],
  ["Glitch Cathedral", "Gothic arches built from scanlines that shift and tear.", "L", "void_signal", P, { scene: "cathedral", anim: true }],
  ["Scarlet Horizon", "A scarlet sun sinking into layered dark hills.", "U", "crimson_requiem", F, { scene: "horizon", anim: false }],
  ["Blackout", "Pure black with a thin gold line and embossed geometric relief.", "R", "obsidian_dynasty", P, { scene: "blackout", anim: false }],
  ["Cyber Alley", "A narrow alley of pixel signs and pipes, lights blinking.", "R", "pixel_afterlife", P, { scene: "alley", anim: true }],
  ["Celestial Collapse", "A ringed planet breaking apart into slowly drifting debris.", "L", "infinite_night", P, { scene: "collapse", anim: true }],
  ["Shattered Reality", "The sky cracked into manga panels, each showing a different night.", "E", "inkstorm", M("creator_milestone"), { scene: "shattered", anim: false }],
  ["Phantom City", "A city fading into fog, towers half there.", "U", "ghost_frequency", P, { scene: "phantom", anim: false }],
  ["Violet Static", "Soft violet static with a few drifting sakura petals.", "R", "sakura_after_dark", P, { scene: "violet_static", anim: true }],
  ["The Last Train", "A lit train crossing a dark bridge, windows glowing in a row.", "R", "neon_tokyo", P, { scene: "train", anim: false }],
  ["Inkstorm", "Thick brushstrokes swirling across paper in black and one red.", "U", "inkstorm", F, { scene: "inkstorm", anim: false }],
  ["Silent Eclipse", "A total eclipse with a thin silver corona over still water.", "E", "celestial_noir", M("seasonal_journey"), { scene: "eclipse", anim: false }],
  ["Infinite Nightfall", "A deep starfield with a slow aurora and a gold meteor.", "L", "infinite_night", P, { scene: "nightfall", anim: true }],
]);

// 03 Titles and Nameplates. The title text plus a typographic treatment.
// None of them resemble staff, moderator or verified labels.
export type NameplateP = {
  title: string;
  font: "display" | "serif" | "mono" | "condensed" | "jp";
  fx: "metal" | "blood" | "glitch" | "plain" | "silver" | "scan" | "eclipse" | "rgb" | "neon" | "ink" | "underline" | "echo" | "wave" | "shatter" | "obsidian" | "halo" | "legend" | "smallcaps" | "velvet" | "stars" | "founder" | "staff" | "cofounder";
  a: string;
  b: string;
  emblem: string;
  border: "none" | "line" | "bracket" | "slash" | "tube" | "tag" | "double";
};
export const nameplates = mk<NameplateP>("nameplate", [
  ["Night Architect", "Gold metal lettering in square brackets, with a diamond mark.", "R", "obsidian_dynasty", P, { title: "Night Architect", font: "display", fx: "metal", a: "#f3e2a9", b: "#9c7a2b", emblem: "◆", border: "bracket" }],
  ["Crimson Phantom", "Blood-red gradient type cut by a diagonal slash, marked 紅.", "E", "crimson_requiem", P, { title: "Crimson Phantom", font: "display", fx: "blood", a: "#ff4d6a", b: "#8a0418", emblem: "紅", border: "slash" }],
  ["Voidwalker", "Monospace type that splits into violet and cyan.", "R", "void_signal", P, { title: "Voidwalker", font: "mono", fx: "glitch", a: "#7c5cff", b: "#2ee6ff", emblem: "▚", border: "line" }],
  ["Silent Signal", "Quiet grey monospace with a thin rule. Free for everyone.", "C", "ghost_frequency", F, { title: "Silent Signal", font: "mono", fx: "plain", a: "#bdbdbd", b: "#5c5c5c", emblem: "◌", border: "line" }],
  ["Moonlit Rebel", "Silver serif italic with a crescent mark.", "U", "celestial_noir", F, { title: "Moonlit Rebel", font: "serif", fx: "silver", a: "#e6ebf2", b: "#8a93a3", emblem: "☾", border: "none" }],
  ["Digital Ghost", "Scanline type with a faint cursor, as if typed by a ghost.", "R", "void_signal", M("discovery_journey"), { title: "Digital Ghost", font: "mono", fx: "scan", a: "#c8fff1", b: "#2a5c52", emblem: "▮", border: "none" }],
  ["Eclipse Born", "Dark type rimmed by a glowing corona.", "E", "infinite_night", P, { title: "Eclipse Born", font: "display", fx: "eclipse", a: "#ffffff", b: "#5b6cff", emblem: "●", border: "double" }],
  ["Chaos Poet", "Chunky type with an RGB offset, arcade style.", "U", "pixel_afterlife", P, { title: "Chaos Poet", font: "mono", fx: "rgb", a: "#ffd23f", b: "#39ff88", emblem: "✦", border: "tag" }],
  ["Neon Drifter", "Neon-tube italic in pink and cyan, softly glowing.", "R", "neon_tokyo", P, { title: "Neon Drifter", font: "display", fx: "neon", a: "#ff2bd6", b: "#28f0ff", emblem: "⚡", border: "tube" }],
  ["Ink Sovereign", "Heavy black serif on a paper tag with a red seal.", "E", "inkstorm", M("personal_archive"), { title: "Ink Sovereign", font: "serif", fx: "ink", a: "#0a0a0a", b: "#e5102f", emblem: "墨", border: "tag" }],
  ["Midnight Entity", "Bold white type with a crimson underline. Free for everyone.", "C", "midnight_essentials", F, { title: "Midnight Entity", font: "display", fx: "underline", a: "#ffffff", b: "#e5102f", emblem: "", border: "none" }],
  ["Scarlet Echo", "Scarlet type trailed by fading echoes.", "U", "crimson_requiem", P, { title: "Scarlet Echo", font: "condensed", fx: "echo", a: "#ff4d6a", b: "#5a0613", emblem: "》", border: "none" }],
  ["Phantom Frequency", "Wide-spaced grey gradient type, like a radio band.", "R", "ghost_frequency", P, { title: "Phantom Frequency", font: "condensed", fx: "wave", a: "#f0f0f0", b: "#6b6b6b", emblem: "〰", border: "line" }],
  ["Dream Breaker", "Rose type split by a hairline crack.", "E", "sakura_after_dark", P, { title: "Dream Breaker", font: "display", fx: "shatter", a: "#ff8fb4", b: "#7a2950", emblem: "✕", border: "none" }],
  ["Obsidian Soul", "Glossy black plate with gold edges and engraved type.", "E", "obsidian_dynasty", P, { title: "Obsidian Soul", font: "serif", fx: "obsidian", a: "#e0b54f", b: "#141414", emblem: "♛", border: "double" }],
  ["Static Angel", "Soft white type with a halo glow. Free for everyone.", "U", "ghost_frequency", F, { title: "Static Angel", font: "display", fx: "halo", a: "#ffffff", b: "#bdbdbd", emblem: "✧", border: "none" }],
  ["Afterdark Legend", "Crimson-to-gold type with a slow light sweep.", "L", "crimson_requiem", P, { title: "Afterdark Legend", font: "display", fx: "legend", a: "#e5102f", b: "#f3c45a", emblem: "夜", border: "bracket" }],
  ["Lunar Outcast", "Silver small caps with moon phases.", "R", "celestial_noir", P, { title: "Lunar Outcast", font: "serif", fx: "smallcaps", a: "#dfe5ee", b: "#7b8496", emblem: "◐", border: "line" }],
  ["Velvet Nightmare", "Deep violet serif with a rose highlight.", "R", "sakura_after_dark", M("community_regular"), { title: "Velvet Nightmare", font: "serif", fx: "velvet", a: "#c48cff", b: "#ff8fb4", emblem: "❦", border: "none" }],
  ["Yoru Eternal", "Starfield type with a gold 夜 seal.", "L", "infinite_night", P, { title: "Yoru Eternal", font: "jp", fx: "stars", a: "#e9e6ff", b: "#5b6cff", emblem: "夜", border: "double" }],
]);

// 04 Theme Forge+ starter themes. Each defines the whole interface palette;
// contrast is checked in tests (body text ≥ 7:1, secondary text ≥ 4.5:1).
export type ThemeP = { mode: "dark" | "light"; bg: string; bg2: string; card: string; card2: string; line: string; ink: string; ink2: string; muted: string; hue: number };
export const themes = mk<ThemeP>("theme", [
  ["Obsidian", "Neutral near-black with YORU red. The default, refined.", "C", "midnight_essentials", F, { mode: "dark", bg: "#070707", bg2: "#0b0b0b", card: "#111111", card2: "#191919", line: "#272727", ink: "#f4f4f4", ink2: "#d4d4d4", muted: "#9a9a9a", hue: 351 }],
  ["Crimson Night", "Warm black with a red tint in every surface.", "U", "crimson_requiem", F, { mode: "dark", bg: "#0b0405", bg2: "#100607", card: "#170a0c", card2: "#211012", line: "#3a1a1e", ink: "#fbeff0", ink2: "#e5cdd0", muted: "#b08d92", hue: 352 }],
  ["Violet Abyss", "Deep violet surfaces with electric purple accents.", "R", "void_signal", P, { mode: "dark", bg: "#07050d", bg2: "#0b0814", card: "#120d1f", card2: "#1a132c", line: "#2e2448", ink: "#f2eeff", ink2: "#d6ccf5", muted: "#a497c7", hue: 262 }],
  ["Electric Tokyo", "Ink-blue night with neon magenta highlights.", "E", "neon_tokyo", P, { mode: "dark", bg: "#05040c", bg2: "#090716", card: "#100c22", card2: "#18122f", line: "#2c2250", ink: "#f4f0ff", ink2: "#d9d2f7", muted: "#a59ccc", hue: 312 }],
  ["Silver Eclipse", "Cool graphite with silver-blue accents.", "R", "celestial_noir", P, { mode: "dark", bg: "#08090b", bg2: "#0c0e11", card: "#13161a", card2: "#1b1f25", line: "#2b3038", ink: "#f1f4f8", ink2: "#d3d9e2", muted: "#9aa4b2", hue: 214 }],
  ["Toxic Signal", "Black-green surfaces with an acid green accent.", "E", "pixel_afterlife", P, { mode: "dark", bg: "#040805", bg2: "#070c08", card: "#0d140e", card2: "#131d15", line: "#213226", ink: "#effff2", ink2: "#cfead5", muted: "#8fb39a", hue: 140 }],
  ["Rose Static", "Muted plum with soft rose accents.", "R", "sakura_after_dark", P, { mode: "dark", bg: "#0b0609", bg2: "#10090d", card: "#180e14", card2: "#21131b", line: "#3a2431", ink: "#fff0f6", ink2: "#ebd0dd", muted: "#b9929f", hue: 335 }],
  ["Frozen Neon", "Icy navy with a cyan accent.", "R", "neon_tokyo", P, { mode: "dark", bg: "#04080b", bg2: "#070c11", card: "#0c141b", card2: "#121c25", line: "#203241", ink: "#eefaff", ink2: "#cde6f2", muted: "#8eacbd", hue: 190 }],
  ["Blood Moon", "Dark rust surfaces under an orange-red moon accent.", "E", "crimson_requiem", M("creative_streak"), { mode: "dark", bg: "#0a0504", bg2: "#100806", card: "#180d0a", card2: "#22130f", line: "#3d231b", ink: "#fff3ee", ink2: "#f0d6cc", muted: "#bb968a", hue: 12 }],
  ["Cyber Cathedral", "Stone grey with stained-glass violet accents.", "E", "void_signal", P, { mode: "dark", bg: "#08080a", bg2: "#0d0d10", card: "#141418", card2: "#1d1d23", line: "#2f2f3a", ink: "#f3f2f8", ink2: "#d6d4e2", muted: "#9e9bb0", hue: 275 }],
  ["Deep Ocean", "Midnight teal surfaces with a sea-green accent.", "U", "midnight_essentials", F, { mode: "dark", bg: "#03080a", bg2: "#050d10", card: "#0a1519", card2: "#0f1e23", line: "#1b3238", ink: "#eefcff", ink2: "#cce8ec", muted: "#89adb3", hue: 176 }],
  ["Monochrome Ink", "Paper white and pure ink black. A light theme.", "U", "inkstorm", F, { mode: "light", bg: "#f4f2ee", bg2: "#fbfaf7", card: "#ffffff", card2: "#eeebe5", line: "#d9d4ca", ink: "#0a0a0a", ink2: "#262626", muted: "#5c5852", hue: 352 }],
  ["Golden Hour", "Warm cream surfaces with gold and ink. A light theme.", "R", "obsidian_dynasty", P, { mode: "light", bg: "#f7f1e6", bg2: "#fcf8f1", card: "#fffdf9", card2: "#f1e8d8", line: "#e0d2b8", ink: "#1a140a", ink2: "#382c18", muted: "#6e5d3f", hue: 40 }],
  ["Ghost Protocol", "Flat greys with a white accent, almost colourless.", "R", "ghost_frequency", M("night_archivist"), { mode: "dark", bg: "#080808", bg2: "#0d0d0d", card: "#141414", card2: "#1c1c1c", line: "#2c2c2c", ink: "#f5f5f5", ink2: "#d9d9d9", muted: "#a0a0a0", hue: 0 }],
  ["Sakura After Dark", "Deep violet-black with cherry blossom pink.", "E", "sakura_after_dark", P, { mode: "dark", bg: "#09060c", bg2: "#0e0912", card: "#160f1c", card2: "#1f1527", line: "#352641", ink: "#fff2f8", ink2: "#ecd2e3", muted: "#b495ab", hue: 330 }],
  ["Digital Rain", "Terminal black with phosphor green.", "R", "pixel_afterlife", P, { mode: "dark", bg: "#030603", bg2: "#050a05", card: "#0a120a", card2: "#0f1a0f", line: "#1d2f1d", ink: "#ecffec", ink2: "#c9ebc9", muted: "#86b086", hue: 128 }],
  ["Celestial Void", "Blue-black space with a starlight accent.", "E", "infinite_night", M("legacy_display"), { mode: "dark", bg: "#04040a", bg2: "#070710", card: "#0d0d1a", card2: "#141426", line: "#25254a", ink: "#f0f0ff", ink2: "#d1d1f0", muted: "#9797c2", hue: 232 }],
  ["Arcade Midnight", "Purple-black with arcade yellow.", "R", "pixel_afterlife", P, { mode: "dark", bg: "#07050b", bg2: "#0b0812", card: "#130e1d", card2: "#1b1428", line: "#2f2445", ink: "#fffbe8", ink2: "#ebe2c4", muted: "#b0a587", hue: 48 }],
  ["Phantom Blue", "Desaturated steel blue, calm and cold.", "U", "ghost_frequency", P, { mode: "dark", bg: "#06080a", bg2: "#0a0d10", card: "#11161b", card2: "#182028", line: "#28333e", ink: "#eff5fa", ink2: "#d0dbe5", muted: "#93a3b3", hue: 205 }],
  ["Infinite Black", "True black with a gold-white accent. The Pro flagship.", "L", "infinite_night", P, { mode: "dark", bg: "#000000", bg2: "#050505", card: "#0b0b0b", card2: "#141414", line: "#242424", ink: "#ffffff", ink2: "#dcdcdc", muted: "#9e9e9e", hue: 45 }],
]);

// 05 Interface Effects. Ambient particle layers and page transitions.
// All of them stop on reduced motion, in background tabs and on data saver.
export type EffectP = {
  kind: "particles" | "transition";
  shape: "dot" | "drop" | "glyph" | "spark" | "smoke" | "star" | "petal" | "arc" | "shard" | "line" | "pulse" | "ring";
  colors: string[];
  count: number;
  speed: number;
  dir: "down" | "up" | "drift" | "radial" | "none";
  transition?: "shatter" | "speedlines" | "eclipse" | "ink";
};
export const effects = mk<EffectP>("effect", [
  ["Crimson Particles", "Small crimson embers rising slowly at the edges of the screen.", "U", "crimson_requiem", P, { kind: "particles", shape: "dot", colors: ["#e5102f", "#ff6b81"], count: 36, speed: 0.4, dir: "up" }],
  ["Falling Ink", "Slow ink drops falling in the background. Free for everyone.", "C", "inkstorm", F, { kind: "particles", shape: "drop", colors: ["#141414", "#2a2a2a"], count: 24, speed: 0.6, dir: "down" }],
  ["Digital Rain", "Faint green glyph columns falling behind the feed.", "R", "pixel_afterlife", P, { kind: "particles", shape: "glyph", colors: ["#39ff88", "#1f8f4c"], count: 28, speed: 0.8, dir: "down" }],
  ["Moon Dust", "Silver dust drifting gently. Free for everyone.", "C", "celestial_noir", F, { kind: "particles", shape: "dot", colors: ["#e6ebf2", "#9aa4b2"], count: 40, speed: 0.15, dir: "drift" }],
  ["Neon Pulse", "A slow neon glow breathing at the screen edges (no flashing).", "U", "neon_tokyo", F, { kind: "particles", shape: "pulse", colors: ["#ff2bd6", "#28f0ff"], count: 2, speed: 0.2, dir: "none" }],
  ["Glitch Flicker", "Occasional thin scan bars sliding past, never more than once a second.", "R", "void_signal", P, { kind: "particles", shape: "line", colors: ["#2ee6ff", "#ff3b6b"], count: 3, speed: 0.5, dir: "down" }],
  ["Celestial Drift", "Tiny stars drifting diagonally across a dark sky.", "R", "celestial_noir", M("first_collection"), { kind: "particles", shape: "star", colors: ["#ffffff", "#c9d1e0"], count: 34, speed: 0.25, dir: "drift" }],
  ["Black Smoke", "Soft black smoke curling up from the bottom edge.", "E", "obsidian_dynasty", P, { kind: "particles", shape: "smoke", colors: ["#000000", "#1a1a1a"], count: 10, speed: 0.2, dir: "up" }],
  ["Scarlet Sparks", "Bright scarlet sparks rising and fading quickly.", "R", "crimson_requiem", P, { kind: "particles", shape: "spark", colors: ["#ff3b3b", "#ffb36b"], count: 26, speed: 0.9, dir: "up" }],
  ["Holographic Shimmer", "A slow rainbow sheen drifting across the background.", "L", "void_signal", P, { kind: "particles", shape: "pulse", colors: ["#7c5cff", "#2ee6ff", "#ff2bd6"], count: 3, speed: 0.12, dir: "drift" }],
  ["Ghost Trails", "Pale, slow streaks that follow the edges like spectral trails.", "R", "ghost_frequency", P, { kind: "particles", shape: "line", colors: ["#e5e5e5", "#7a7a7a"], count: 6, speed: 0.3, dir: "drift" }],
  ["Starfall", "A few falling stars crossing the sky now and then.", "E", "infinite_night", P, { kind: "particles", shape: "star", colors: ["#fff6d6", "#e9e6ff"], count: 5, speed: 1.4, dir: "down" }],
  ["Electric Arcs", "Small blue arcs crackling at the corners, gently.", "E", "neon_tokyo", P, { kind: "particles", shape: "arc", colors: ["#7fc3ff", "#ffffff"], count: 6, speed: 0.6, dir: "none" }],
  ["Sakura Petals", "Restrained pink petals drifting down.", "R", "sakura_after_dark", P, { kind: "particles", shape: "petal", colors: ["#ff9ec0", "#ffd0e0"], count: 18, speed: 0.4, dir: "down" }],
  ["Void Distortion", "A slow ripple warping the background vignette.", "E", "void_signal", P, { kind: "particles", shape: "ring", colors: ["#7c5cff", "#2a1d55"], count: 3, speed: 0.15, dir: "radial" }, "experimental"],
  ["Shattered Glass Transition", "Pages break into glass shards when you move between screens.", "L", "crimson_requiem", P, { kind: "transition", shape: "shard", colors: ["#ffffff", "#e5102f"], count: 14, speed: 1, dir: "radial", transition: "shatter" }, "experimental"],
  ["Manga Speed Lines", "A burst of speed lines when you change screens. Free for everyone.", "U", "inkstorm", F, { kind: "transition", shape: "line", colors: ["#ffffff"], count: 40, speed: 1, dir: "radial", transition: "speedlines" }],
  ["Aurora Drift", "A slow green-violet aurora band across the top of the screen.", "E", "infinite_night", M("seasonal_journey"), { kind: "particles", shape: "pulse", colors: ["#39ffb0", "#7c5cff"], count: 2, speed: 0.08, dir: "drift" }],
  ["Static Bloom", "Soft static grain blooming and fading in the corners.", "R", "ghost_frequency", P, { kind: "particles", shape: "dot", colors: ["#ffffff", "#5c5c5c"], count: 60, speed: 0.05, dir: "none" }],
  ["Eclipse Transition", "A dark disc sweeps across the screen between pages.", "L", "celestial_noir", P, { kind: "transition", shape: "ring", colors: ["#000000", "#c9d1e0"], count: 1, speed: 1, dir: "none", transition: "eclipse" }],
]);
