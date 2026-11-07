import { F, M, P, mk } from "./mk";

// The functional systems. These are presets for tools that work on the
// member's own data: they never invent content, numbers or communities.

// 08 Personal Collections+. Templates, not pre-filled collections: picking one
// fills in a name, emoji, description, cover and sort that the member edits.
export type CollectionP = {
  emoji: string;
  title: string;
  about: string;
  cover: "panels" | "shelf" | "frames" | "wave" | "grid" | "board" | "halftone" | "cards" | "stars" | "plain" | "stamp" | "rain" | "petals" | "pixel" | "ink";
  a: string;
  b: string;
  sort: "added_desc" | "added_asc" | "popular";
  visibility: "private" | "members";
};
export const collectionTemplates = mk<CollectionP>("collection", [
  ["Anime Watchlist", "Shows to watch, watching and finished.", "C", "the_archive", F, { emoji: "🌸", title: "Anime Watchlist", about: "Shows I'm watching or want to start.", cover: "panels", a: "#ff8fb4", b: "#1b1030", sort: "added_desc", visibility: "members" }],
  ["Manga Shelf", "A shelf for series and favourite chapters.", "C", "the_archive", F, { emoji: "📖", title: "Manga Shelf", about: "Series and chapters worth keeping.", cover: "shelf", a: "#f4f2ee", b: "#0a0a0a", sort: "added_asc", visibility: "members" }],
  ["Favorite Artists", "Posts from artists you keep coming back to.", "U", "the_archive", P, { emoji: "🎨", title: "Favorite Artists", about: "Work by artists I love.", cover: "frames", a: "#ffd23f", b: "#2a1f08", sort: "popular", visibility: "members" }],
  ["Vocaloid Vault", "Songs, covers and producers.", "R", "the_archive", P, { emoji: "🎤", title: "Vocaloid Vault", about: "Songs, covers and producers.", cover: "wave", a: "#28f0ff", b: "#062a30", sort: "added_desc", visibility: "members" }],
  ["Music Rotation", "What's on repeat right now.", "C", "the_archive", F, { emoji: "🎧", title: "Music Rotation", about: "On repeat this month.", cover: "wave", a: "#ff2bd6", b: "#1a0618", sort: "added_desc", visibility: "members" }],
  ["Gaming Archive", "Clips, screenshots and game talk.", "U", "the_archive", P, { emoji: "🎮", title: "Gaming Archive", about: "Clips, screenshots and good threads.", cover: "pixel", a: "#39ff88", b: "#08140c", sort: "added_desc", visibility: "members" }],
  ["Artwork Gallery", "A gallery wall of saved art.", "R", "the_archive", P, { emoji: "🖼️", title: "Artwork Gallery", about: "Art I want to look at again.", cover: "frames", a: "#e0b54f", b: "#141008", sort: "popular", visibility: "members" }],
  ["Inspiration Board", "References and sparks for your own work.", "U", "the_archive", F, { emoji: "📌", title: "Inspiration Board", about: "Things that make me want to make things.", cover: "board", a: "#ff6b3d", b: "#1f0d06", sort: "added_desc", visibility: "private" }],
  ["Memes After Dark", "The ones that got you at 2am.", "U", "the_archive", P, { emoji: "🐸", title: "Memes After Dark", about: "The ones that got me at 2am.", cover: "halftone", a: "#ffd23f", b: "#0a0a0a", sort: "added_desc", visibility: "members" }],
  ["Character Archive", "Characters, designs and fan art.", "R", "the_archive", P, { emoji: "🎭", title: "Character Archive", about: "Characters and designs I love.", cover: "cards", a: "#c48cff", b: "#160d22", sort: "added_asc", visibility: "members" }],
  ["Recommendations", "Things you'd tell a friend to try.", "C", "the_archive", F, { emoji: "⭐", title: "Recommendations", about: "If you only try a few things, try these.", cover: "stars", a: "#f5b301", b: "#1f1600", sort: "popular", visibility: "members" }],
  ["Weekend Queue", "Saved for when you have time.", "U", "the_archive", P, { emoji: "🛋️", title: "Weekend Queue", about: "Saved for the weekend.", cover: "plain", a: "#3d8bff", b: "#081428", sort: "added_asc", visibility: "private" }],
  ["Creative References", "Poses, palettes, techniques.", "R", "night_studio", P, { emoji: "✏️", title: "Creative References", about: "Poses, palettes and techniques.", cover: "grid", a: "#f4f2ee", b: "#1a1a1a", sort: "added_desc", visibility: "private" }],
  ["Favorite Creators", "Your favourite people's best posts.", "U", "the_archive", P, { emoji: "💫", title: "Favorite Creators", about: "Best posts from people I follow closely.", cover: "cards", a: "#e5102f", b: "#1a0508", sort: "popular", visibility: "members" }],
  ["Hidden Gems", "Underrated posts that deserve more eyes.", "R", "explorer_atlas", M("discovery_journey"), { emoji: "💎", title: "Hidden Gems", about: "Underrated things that deserve more eyes.", cover: "stamp", a: "#2ee6ff", b: "#052025", sort: "added_desc", visibility: "members" }],
  ["Seasonal Favorites", "This season's highlights.", "U", "the_archive", P, { emoji: "🍂", title: "Seasonal Favorites", about: "This season's highlights.", cover: "petals", a: "#ffb36b", b: "#241206", sort: "added_desc", visibility: "members" }],
  ["Nostalgia Folder", "Old favourites and throwbacks.", "R", "the_archive", P, { emoji: "📼", title: "Nostalgia Folder", about: "Throwbacks.", cover: "rain", a: "#c9d1e0", b: "#12151c", sort: "added_asc", visibility: "private" }],
  ["Personal Top Ten", "Your ten favourite things, in order.", "E", "the_archive", P, { emoji: "🔟", title: "Personal Top Ten", about: "My ten favourites, in order.", cover: "ink", a: "#ffffff", b: "#e5102f", sort: "added_asc", visibility: "members" }],
  ["Midnight Discoveries", "Things you found late at night.", "R", "the_archive", M("night_archivist"), { emoji: "🌙", title: "Midnight Discoveries", about: "Found late at night.", cover: "stars", a: "#5b6cff", b: "#05060f", sort: "added_desc", visibility: "members" }],
  ["Custom Archive", "Start blank: your own name, cover and sort.", "C", "the_archive", F, { emoji: "📁", title: "", about: "", cover: "plain", a: "#e5102f", b: "#0a0a0a", sort: "added_desc", visibility: "private" }],
]);

// 09 Draft Studio. Templates for the post composer. Nothing is ever posted
// automatically: a template only fills the draft.
export type DraftP = {
  kind: "post" | "poll";
  body: string;
  tags: string[];
  media: "none" | "image" | "video";
  options?: string[];
  accent: string;
};
export const draftTemplates = mk<DraftP>("draft", [
  ["Minimal Post", "One line, no extras.", "C", "night_studio", F, { kind: "post", body: "", tags: [], media: "none", accent: "#e5102f" }],
  ["Manga Quote", "A quote, the series and why it hit.", "U", "night_studio", F, { kind: "post", body: "「 … 」\n\n— from [series], ch. [n]\n\nWhy it hit: ", tags: ["manga"], media: "none", accent: "#f4f2ee" }],
  ["Creator Announcement", "Something you made is coming.", "R", "night_studio", P, { kind: "post", body: "📣 [What it is] is coming.\n\nWhen: [date]\nWhere: [link]\n\n", tags: ["announcement"], media: "image", accent: "#ff6b3d" }],
  ["Music Release", "New track, cover or mix.", "R", "night_studio", P, { kind: "post", body: "🎵 New release: [title]\n\n[genre / mood]\nListen: [link]", tags: ["music"], media: "image", accent: "#ff2bd6" }],
  ["Artwork Reveal", "Show a finished piece with a few notes.", "R", "night_studio", P, { kind: "post", body: "🎨 [Title]\n\nMedium: [tools]\nTime: [hours]\n\nNotes: ", tags: ["art"], media: "image", accent: "#ffd23f" }],
  ["Recommendation Card", "Tell people what to try and why.", "U", "night_studio", F, { kind: "post", body: "⭐ Recommendation: [title]\n\nIf you like: [similar]\nWhy: ", tags: ["recommendation"], media: "none", accent: "#f5b301" }],
  ["Question Post", "Ask the timeline something.", "C", "night_studio", F, { kind: "post", body: "❓ ", tags: ["question"], media: "none", accent: "#3d8bff" }],
  ["Short Review", "A score and three lines.", "U", "night_studio", P, { kind: "post", body: "📝 [Title] — [score]/10\n\n+ \n+ \n− ", tags: ["review"], media: "none", accent: "#39ff88" }],
  ["Long-Form Post", "Room to write: headline, body, sign-off.", "R", "night_studio", P, { kind: "post", body: "[Headline]\n\n[First thought]\n\n[Second thought]\n\n[Sign-off]", tags: [], media: "none", accent: "#c9d1e0" }],
  ["Character Spotlight", "Why this character matters to you.", "R", "night_studio", P, { kind: "post", body: "🎭 Character spotlight: [name] ([series])\n\nWhy they matter: ", tags: ["characters"], media: "image", accent: "#c48cff" }],
  ["Poll Introduction", "A question with ready-made options.", "U", "night_studio", F, { kind: "poll", body: "Settle this:", tags: [], media: "none", options: ["Option one", "Option two"], accent: "#e5102f" }],
  ["Event Announcement", "Date, place and what's happening.", "R", "night_studio", P, { kind: "post", body: "📅 [Event]\n\nWhen: [date, time]\nWhere: [place / link]\nWhat: ", tags: ["event"], media: "image", accent: "#ff3b4e" }],
  ["Weekly Recap", "Three things from your week.", "U", "night_studio", P, { kind: "post", body: "This week:\n1. \n2. \n3. ", tags: ["weeklyrecap"], media: "none", accent: "#7c5cff" }],
  ["Project Update", "Progress, next step, blockers.", "R", "night_studio", P, { kind: "post", body: "🛠 [Project] update\n\nDone: \nNext: \nStuck on: ", tags: ["wip"], media: "image", accent: "#00e0a4" }],
  ["Photo Caption", "A photo with a short caption.", "C", "night_studio", F, { kind: "post", body: "", tags: [], media: "image", accent: "#f5f5f5" }],
  ["Video Introduction", "Introduce a clip in a line or two.", "U", "night_studio", P, { kind: "post", body: "▶ [What happens in the clip]", tags: ["video"], media: "video", accent: "#2ee6ff" }],
  ["Community Question", "Ask for everyone's take, with a poll.", "R", "night_studio", M("community_regular"), { kind: "poll", body: "Community question: ", tags: ["community"], media: "none", options: ["Yes", "No", "It depends"], accent: "#3d8bff" }],
  ["Thread Starter", "Open a topic for replies.", "U", "night_studio", P, { kind: "post", body: "🧵 Let's talk about [topic].\n\nMy take: \n\nYours?", tags: ["thread"], media: "none", accent: "#ff8fb4" }],
  ["Personal Journal", "A quiet note to yourself (kept as a draft until you post it).", "R", "night_studio", P, { kind: "post", body: "Tonight: ", tags: [], media: "none", accent: "#5b6cff" }],
  ["Blank Canvas", "An empty draft with nothing pre-filled.", "C", "night_studio", F, { kind: "post", body: "", tags: [], media: "none", accent: "#0a0a0a" }],
]);

// Widgets for Creator Analytics (10) and Profile Insights (14). Each reads real
// aggregates from `get_creator_analytics` / `get_profile_insights`. When there
// isn't enough data a widget says so; it never shows sample numbers.
export const WIDGETS = [
  "kpis", "reach", "engagement", "new_engagers", "compare", "types", "week", "month", "top", "recent", "timeline",
  "hours", "visits", "reaction_kinds", "comments", "consistency", "history", "type_perf", "summary",
  "milestones", "bests", "range", "growth",
] as const;
export type Widget = (typeof WIDGETS)[number];
export type BoardP = { widgets: Widget[]; custom?: boolean };

export const dashboards = mk<BoardP>("dashboard", [
  ["Overview", "Totals, trend and your top posts at a glance.", "C", "night_analyst", F, { widgets: ["kpis", "engagement", "top"] }],
  ["Reach Trends", "How many different members engage with you each week.", "U", "night_analyst", P, { widgets: ["reach", "kpis"] }],
  ["Engagement Trends", "Reactions and comments per week.", "U", "night_analyst", F, { widgets: ["engagement", "timeline"] }],
  ["Follower Growth", "YORU has no follower count; this shows new members engaging with you each week.", "R", "night_analyst", P, { widgets: ["new_engagers", "reach"] }],
  ["Post Comparison", "Pick two posts and compare them side by side.", "R", "night_analyst", P, { widgets: ["compare"] }],
  ["Content Type Breakdown", "Text, images, video, GIFs and polls you've posted.", "U", "night_analyst", P, { widgets: ["types", "type_perf"] }],
  ["Weekly Performance", "The last 7 days against the 7 before.", "C", "night_analyst", F, { widgets: ["week", "timeline"] }],
  ["Monthly Performance", "The last 30 days against the 30 before.", "U", "night_analyst", P, { widgets: ["month", "engagement"] }],
  ["Top Posts", "Your posts ranked by reactions and comments.", "C", "night_analyst", F, { widgets: ["top"] }],
  ["Recent Posts", "How your latest posts are doing.", "C", "night_analyst", F, { widgets: ["recent"] }],
  ["Engagement Timeline", "Day-by-day reactions and comments for 30 days.", "U", "night_analyst", P, { widgets: ["timeline"] }],
  ["Audience Activity", "The hours (UTC) when people react to your posts. Shown only once there's enough data.", "R", "night_analyst", P, { widgets: ["hours"] }],
  ["Profile Visit Trends", "Visits to your profile per week, counted from launch day onward.", "R", "night_analyst", P, { widgets: ["visits"] }],
  ["Reaction Breakdown", "Which reactions your posts get.", "U", "night_analyst", P, { widgets: ["reaction_kinds"] }],
  ["Comment Activity", "Comments on your posts per week.", "U", "night_analyst", P, { widgets: ["comments", "timeline"] }],
  ["Content Consistency", "Which days you posted over the last 12 weeks.", "R", "night_analyst", M("creative_streak"), { widgets: ["consistency"] }],
  ["Historical Comparison", "The last 90 days against the 90 before.", "E", "night_analyst", P, { widgets: ["history"] }],
  ["Performance by Content Type", "Average reactions and comments per post type.", "R", "night_analyst", P, { widgets: ["type_perf"] }],
  ["Creator Summary", "A plain-language summary of your numbers.", "E", "night_analyst", P, { widgets: ["summary", "kpis", "top"] }],
  ["Custom Dashboard", "Pick your own widgets and their order.", "L", "night_analyst", P, { widgets: ["kpis", "engagement", "top"], custom: true }],
]);

export const insightLayouts = mk<BoardP>("insight", [
  ["Overview Card", "Your profile's totals in one card.", "C", "night_analyst", F, { widgets: ["kpis"] }],
  ["Visit Trend", "Profile visits per week (aggregate; never who visited).", "U", "night_analyst", P, { widgets: ["visits"] }],
  ["Profile Growth", "New members engaging with you over time.", "U", "night_analyst", P, { widgets: ["growth"] }],
  ["Weekly Summary", "This week against last week.", "C", "night_analyst", F, { widgets: ["week"] }],
  ["Monthly Summary", "This month against last month.", "U", "night_analyst", F, { widgets: ["month"] }],
  ["Content Overview", "What you've posted, by type.", "U", "night_analyst", P, { widgets: ["types"] }],
  ["Follower Trend", "No followers on YORU: this counts members engaging with you each week.", "R", "night_analyst", P, { widgets: ["new_engagers"] }],
  ["Post Activity", "How often you post.", "C", "night_analyst", F, { widgets: ["consistency"] }],
  ["Engagement Timeline", "Day by day for 30 days.", "U", "night_analyst", P, { widgets: ["timeline"] }],
  ["Profile Milestones", "Milestones you've earned and what's next.", "U", "night_milestones", F, { widgets: ["milestones"] }],
  ["Historical Snapshot", "The last 90 days against the 90 before.", "R", "night_analyst", P, { widgets: ["history"] }],
  ["Content Breakdown", "Reactions by kind and posts by type.", "R", "night_analyst", P, { widgets: ["reaction_kinds", "types"] }],
  ["Creator Summary", "Your numbers, in words.", "R", "night_analyst", P, { widgets: ["summary"] }],
  ["Recent Activity", "Your latest posts and how they're doing.", "C", "night_analyst", F, { widgets: ["recent"] }],
  ["Personal Bests", "Your best post, best week and longest streak.", "E", "night_analyst", M("personal_archive"), { widgets: ["bests"] }],
  ["Growth Timeline", "Engagement and visits over time together.", "E", "night_analyst", P, { widgets: ["growth", "visits"] }],
  ["Custom Date Range", "Totals for any range you choose.", "R", "night_analyst", P, { widgets: ["range"] }],
  ["Compact Statistics", "Just the numbers, small.", "U", "night_analyst", P, { widgets: ["kpis"] }],
  ["Visual Analytics", "Charts first: timeline, kinds, hours.", "E", "night_analyst", P, { widgets: ["timeline", "reaction_kinds", "hours"] }],
  ["Custom Insight Board", "Your own selection, your own order.", "L", "night_analyst", P, { widgets: ["kpis", "visits", "milestones"], custom: true }],
]);

// 11 Advanced Feed Controls. Every preset is a set of real filters run by the
// database (`get_feed_preset`). They only filter and sort what you see; they
// never change anyone's ranking or reach.
export type FeedP = {
  sort: "latest" | "top";
  tags?: string[];
  interests?: boolean;
  media?: "any" | "image" | "video" | "text";
  kinds?: ("post" | "poll" | "repost" | "news" | "roast")[];
  authors?: "any" | "new" | "active" | "interacted" | "creators";
  days?: number;
  muted?: boolean;
  custom?: boolean;
};
export const feedPresets = mk<FeedP>("feed", [
  ["Following First", "YORU has no follow list, so this puts people you've reacted to or talked with first.", "U", "explorer_atlas", F, { sort: "latest", authors: "interacted" }],
  ["Anime Discovery", "Posts tagged with anime, newest first.", "C", "explorer_atlas", F, { sort: "latest", tags: ["anime", "seasonalanime", "animerecs"] }],
  ["Manga Discussions", "Manga posts and threads.", "C", "explorer_atlas", F, { sort: "latest", tags: ["manga", "manhwa", "webtoon"] }],
  ["Music and Vocaloid", "Music, Vocaloid, J-pop and J-rock.", "U", "explorer_atlas", P, { sort: "latest", tags: ["music", "vocaloid", "jpop", "jrock"] }],
  ["Gaming", "Gaming posts.", "C", "explorer_atlas", F, { sort: "latest", tags: ["gaming", "games"] }],
  ["Art and Illustration", "Art posts with images.", "U", "explorer_atlas", P, { sort: "latest", tags: ["art", "illustration", "fanart", "drawing"], media: "image" }],
  ["Creator Updates", "Posts by members with a creator category.", "R", "explorer_atlas", P, { sort: "latest", authors: "creators" }],
  ["New Accounts", "Posts from members who joined in the last 30 days. Say hi.", "U", "explorer_atlas", P, { sort: "latest", authors: "new" }],
  ["Recently Active", "Posts from members active in the last day.", "U", "explorer_atlas", P, { sort: "latest", authors: "active" }],
  ["Video Focus", "Only posts with video.", "U", "explorer_atlas", P, { sort: "latest", media: "video" }],
  ["Image Focus", "Only posts with images or GIFs.", "U", "explorer_atlas", P, { sort: "latest", media: "image" }],
  ["Text Discussions", "Only text posts and polls.", "R", "explorer_atlas", P, { sort: "latest", media: "text", kinds: ["post", "poll"] }],
  ["Community Favorites", "Most reacted-to posts this week.", "R", "explorer_atlas", P, { sort: "top", days: 7 }],
  ["Latest Posts", "Everything, newest first. Same as Home.", "C", "explorer_atlas", F, { sort: "latest" }],
  ["Topic Focus", "Posts matching your interests.", "R", "explorer_atlas", M("profile_builder"), { sort: "latest", interests: true }],
  ["Muted Keywords", "Latest posts with your muted words filtered out.", "R", "explorer_atlas", P, { sort: "latest", muted: true }],
  ["Low-Noise Feed", "No reposts, roasts or news: just original posts and polls.", "E", "explorer_atlas", P, { sort: "latest", kinds: ["post", "poll"], muted: true }],
  ["Custom Interest Mix", "Your interests, images and video only.", "E", "explorer_atlas", P, { sort: "latest", interests: true, media: "image" }],
  ["Weekend Browsing", "The most reacted-to media from the last 3 days.", "R", "explorer_atlas", P, { sort: "top", days: 3, media: "image" }],
  ["My Custom Feed", "Build your own: tags, media, post types, sort.", "L", "explorer_atlas", P, { sort: "latest", custom: true }],
]);

// 12 Interest Hubs. YORU has no group system, so a hub is a personal discovery
// page: real posts with matching tags and real members who list the interest.
export type HubP = { emoji: string; tags: string[]; interest?: string; creator?: string; a: string; b: string; custom?: boolean };
export const hubs = mk<HubP>("hub", [
  ["Anime Central", "Anime posts and members who love anime.", "C", "explorer_atlas", F, { emoji: "🌸", tags: ["anime", "animerecs"], interest: "anime", a: "#ff8fb4", b: "#1b1030" }],
  ["Manga Underground", "Manga, manhwa and webtoons.", "C", "explorer_atlas", F, { emoji: "📖", tags: ["manga", "manhwa", "webtoon"], interest: "manga", a: "#f4f2ee", b: "#0a0a0a" }],
  ["Vocaloid Station", "Vocaloid songs, covers and producers.", "U", "explorer_atlas", F, { emoji: "🎤", tags: ["vocaloid", "miku", "utau"], interest: "vocaloid", a: "#28f0ff", b: "#062a30" }],
  ["J-Pop Frequency", "J-pop and J-rock.", "U", "explorer_atlas", P, { emoji: "🎶", tags: ["jpop", "jrock", "citypop"], interest: "jpop", a: "#ff2bd6", b: "#1a0618" }],
  ["Gaming District", "Games, clips and setups.", "C", "explorer_atlas", F, { emoji: "🎮", tags: ["gaming", "games"], interest: "gaming", a: "#39ff88", b: "#08140c" }],
  ["Digital Art Lab", "Digital art and process posts.", "U", "explorer_atlas", P, { emoji: "🎨", tags: ["art", "digitalart", "illustration", "fanart"], interest: "art", a: "#ffd23f", b: "#1f1600" }],
  ["Cosplay Corner", "Cosplay builds and photos.", "U", "explorer_atlas", P, { emoji: "🎭", tags: ["cosplay"], interest: "cosplay", creator: "cosplayer", a: "#c48cff", b: "#160d22" }],
  ["Music Producers", "Producers and musicians sharing work.", "R", "explorer_atlas", P, { emoji: "🎛️", tags: ["producer", "beats", "music"], creator: "musician", a: "#ff6b3d", b: "#1f0d06" }],
  ["Indie Creators", "Members with a creator category, newest first.", "R", "explorer_atlas", P, { emoji: "✨", tags: ["indie", "wip"], creator: "*", a: "#e5102f", b: "#1a0508" }],
  ["Anime Soundtracks", "OSTs, openings and endings.", "R", "explorer_atlas", P, { emoji: "🎼", tags: ["ost", "anisong", "opening"], a: "#5b6cff", b: "#05060f" }],
  ["Manga Collectors", "Shelves, editions and figures.", "R", "explorer_atlas", P, { emoji: "🗿", tags: ["mangacollection", "figures"], interest: "figures", a: "#e0b54f", b: "#141008" }],
  ["Character Design", "Character sheets and design talk.", "R", "explorer_atlas", P, { emoji: "✏️", tags: ["characterdesign", "oc"], creator: "artist", a: "#ff3b4e", b: "#1a0508" }],
  ["Japanese Learning", "Study notes, words and questions.", "U", "explorer_atlas", P, { emoji: "🗾", tags: ["japanese", "nihongo", "日本語"], a: "#f5f5f5", b: "#e5102f" }],
  ["Video Editing", "Edits, AMVs and editing tips.", "R", "explorer_atlas", P, { emoji: "🎬", tags: ["edit", "amv", "videoediting"], creator: "video", a: "#2ee6ff", b: "#052025" }],
  ["Meme Culture", "Memes.", "C", "explorer_atlas", F, { emoji: "🐸", tags: ["memes", "meme"], interest: "memes", a: "#ffd23f", b: "#0a0a0a" }],
  ["Creative Projects", "Works in progress and finished projects.", "U", "explorer_atlas", P, { emoji: "🛠", tags: ["wip", "project", "oc"], a: "#00e0a4", b: "#04140f" }],
  ["Seasonal Anime", "This season's shows.", "U", "explorer_atlas", P, { emoji: "🍂", tags: ["seasonalanime", "simulcast"], a: "#ffb36b", b: "#241206" }],
  ["Recommendations", "Recommendations from everyone.", "C", "explorer_atlas", F, { emoji: "⭐", tags: ["recommendation", "recs", "animerecs"], a: "#f5b301", b: "#1f1600" }],
  ["Community Events", "Events, meetups and watch parties.", "R", "explorer_atlas", M("community_regular"), { emoji: "📅", tags: ["event", "meetup", "watchparty"], a: "#3d8bff", b: "#081428" }],
  ["Custom Interest Hub", "Choose your own tags and interests.", "L", "explorer_atlas", P, { emoji: "🧭", tags: [], a: "#e5102f", b: "#0a0a0a", custom: true }],
]);

// 16 Notification Sound Packs. Original sounds synthesized in the browser
// (WebAudio), so there are no audio files or licences. Off by default; they
// play only after you choose one, and previews only on tap.
export type Note = [freq: number, start: number, dur: number];
export type SoundP = { wave: "sine" | "triangle" | "square" | "sawtooth"; notes: Note[]; gain: number; lp?: number; echo?: number; noise?: number };
export const soundPacks = mk<SoundP>("sound", [
  ["Soft Digital", "Two soft sine blips.", "C", "signal_tuning", F, { wave: "sine", notes: [[880, 0, 0.08], [1320, 0.09, 0.1]], gain: 0.25 }],
  ["Crimson Ping", "A bright ping with a short tail.", "U", "signal_tuning", P, { wave: "triangle", notes: [[1046.5, 0, 0.22]], gain: 0.3, echo: 0.18 }],
  ["Midnight Bell", "A low bell with a long, quiet ring.", "R", "signal_tuning", P, { wave: "sine", notes: [[392, 0, 0.9], [784, 0, 0.5], [1176, 0, 0.25]], gain: 0.22 }],
  ["Neon Pulse", "A filtered pulse that rises.", "R", "signal_tuning", P, { wave: "sawtooth", notes: [[440, 0, 0.12], [660, 0.12, 0.14]], gain: 0.12, lp: 1800 }],
  ["Pixel Pop", "An arcade coin blip.", "U", "signal_tuning", P, { wave: "square", notes: [[988, 0, 0.06], [1319, 0.06, 0.16]], gain: 0.1 }],
  ["Glass Chime", "Three glassy notes. Free for everyone.", "C", "signal_tuning", F, { wave: "sine", notes: [[1568, 0, 0.3], [2093, 0.07, 0.3], [2637, 0.14, 0.4]], gain: 0.16 }],
  ["Celestial Tone", "A shimmering fifth.", "R", "signal_tuning", P, { wave: "triangle", notes: [[659, 0, 0.5], [988, 0.05, 0.6]], gain: 0.2, echo: 0.3 }],
  ["Soft Rain", "A soft hiss with a single drop.", "U", "signal_tuning", M("night_archivist"), { wave: "sine", notes: [[1760, 0.05, 0.08]], gain: 0.2, noise: 0.25, lp: 2400 }],
  ["Static Signal", "A burst of filtered static and a tick.", "R", "signal_tuning", P, { wave: "square", notes: [[2000, 0.08, 0.03]], gain: 0.08, noise: 0.15, lp: 3500 }],
  ["Moonlight Bell", "A high, clear bell.", "R", "signal_tuning", P, { wave: "sine", notes: [[1318.5, 0, 0.6], [2637, 0, 0.3]], gain: 0.18 }],
  ["Arcade Click", "A tiny square-wave click.", "C", "signal_tuning", P, { wave: "square", notes: [[1500, 0, 0.025]], gain: 0.1 }],
  ["Phantom Ping", "A ping that echoes away.", "E", "signal_tuning", P, { wave: "sine", notes: [[987.8, 0, 0.18]], gain: 0.22, echo: 0.42 }],
  ["Velvet Chime", "A warm, low two-note chime.", "R", "signal_tuning", P, { wave: "triangle", notes: [[523.3, 0, 0.35], [659.3, 0.12, 0.45]], gain: 0.22, lp: 2200 }],
  ["Electric Tick", "A short bright tick.", "U", "signal_tuning", P, { wave: "sawtooth", notes: [[2400, 0, 0.03]], gain: 0.07, lp: 5000 }],
  ["Minimal Tone", "One quiet tone. Free for everyone.", "C", "signal_tuning", F, { wave: "sine", notes: [[740, 0, 0.14]], gain: 0.2 }],
  ["Sakura Drop", "A falling pentatonic run.", "E", "signal_tuning", M("art_collector"), { wave: "triangle", notes: [[1174.7, 0, 0.1], [987.8, 0.08, 0.1], [880, 0.16, 0.1], [740, 0.24, 0.2]], gain: 0.18 }],
  ["Deep Echo", "A deep thump with an echo.", "E", "signal_tuning", P, { wave: "sine", notes: [[196, 0, 0.3]], gain: 0.4, echo: 0.35 }],
  ["Silver Note", "A clean single note with a soft attack.", "U", "signal_tuning", P, { wave: "triangle", notes: [[1046.5, 0, 0.3]], gain: 0.2 }],
  ["Cosmic Pulse", "A rising sweep of three tones.", "L", "signal_tuning", P, { wave: "sine", notes: [[330, 0, 0.12], [495, 0.1, 0.12], [742.5, 0.2, 0.3]], gain: 0.22, echo: 0.25 }],
  ["Silent Mode", "No sound at all. Free for everyone.", "C", "signal_tuning", F, { wave: "sine", notes: [], gain: 0 }],
]);

// 17 Post Planner. A template lays out planned slots (a draft template and a
// time) that the member edits before anything is scheduled. Scheduled posts
// are published by the database scheduler; if it isn't running, the planner
// says so and nothing claims to be scheduled.
export type Slot = { day: number; time: string; draft: string };
export type PlannerP = { cadence: "daily" | "weekly" | "monthly" | "sequence" | "custom"; slots: Slot[] };
const d = (day: number, time: string, draft: string): Slot => ({ day, time, draft: `draft.${draft}` });
export const plannerTemplates = mk<PlannerP>("planner", [
  ["Daily Creator", "One post a day for a week, evenings.", "U", "night_studio", P, { cadence: "daily", slots: [0, 1, 2, 3, 4, 5, 6].map((i) => d(i, "20:00", "minimal_post")) }],
  ["Weekly Creator", "One planned post each week for four weeks.", "C", "night_studio", F, { cadence: "weekly", slots: [0, 7, 14, 21].map((i) => d(i, "19:00", "minimal_post")) }],
  ["Music Release", "Teaser, release day and a follow-up.", "R", "night_studio", P, { cadence: "sequence", slots: [d(0, "18:00", "creator_announcement"), d(3, "18:00", "music_release"), d(5, "20:00", "thread_starter")] }],
  ["Artwork Series", "Three pieces over three weeks.", "R", "night_studio", P, { cadence: "weekly", slots: [0, 7, 14].map((i) => d(i, "19:30", "artwork_reveal")) }],
  ["Anime Review", "A weekly episode review.", "U", "night_studio", P, { cadence: "weekly", slots: [0, 7, 14, 21].map((i) => d(i, "21:00", "short_review")) }],
  ["Manga Review", "A chapter review every week.", "U", "night_studio", P, { cadence: "weekly", slots: [0, 7, 14, 21].map((i) => d(i, "21:00", "manga_quote")) }],
  ["Video Release", "Announce, release, then ask for feedback.", "R", "night_studio", P, { cadence: "sequence", slots: [d(0, "17:00", "creator_announcement"), d(2, "18:00", "video_introduction"), d(4, "19:00", "question_post")] }],
  ["Project Diary", "A short update every few days.", "U", "night_studio", P, { cadence: "sequence", slots: [0, 3, 6, 9].map((i) => d(i, "22:00", "project_update")) }],
  ["Community Questions", "A question every other day.", "C", "night_studio", F, { cadence: "sequence", slots: [0, 2, 4].map((i) => d(i, "20:00", "question_post")) }],
  ["Recommendation Series", "One recommendation a week.", "U", "night_studio", P, { cadence: "weekly", slots: [0, 7, 14].map((i) => d(i, "20:30", "recommendation_card")) }],
  ["Event Promotion", "One week out, one day out, and on the day.", "R", "night_studio", P, { cadence: "sequence", slots: [d(0, "18:00", "event_announcement"), d(6, "18:00", "event_announcement"), d(7, "12:00", "minimal_post")] }],
  ["Creator Portfolio", "Five pieces across two weeks.", "E", "night_studio", P, { cadence: "sequence", slots: [0, 3, 6, 9, 12].map((i) => d(i, "19:00", "artwork_reveal")) }],
  ["Weekly Recap", "A recap every Sunday evening.", "C", "night_studio", F, { cadence: "weekly", slots: [0, 7, 14, 21].map((i) => d(i, "21:00", "weekly_recap")) }],
  ["Monthly Highlights", "A highlights post once a month.", "U", "night_studio", P, { cadence: "monthly", slots: [0, 30, 60].map((i) => d(i, "20:00", "long_form_post")) }],
  ["Learning Journey", "Share what you learned, twice a week.", "R", "night_studio", M("creative_streak"), { cadence: "sequence", slots: [0, 3, 7, 10].map((i) => d(i, "21:00", "personal_journal")) }],
  ["Work in Progress", "WIP, more WIP, then the reveal.", "R", "night_studio", P, { cadence: "sequence", slots: [d(0, "20:00", "project_update"), d(4, "20:00", "project_update"), d(8, "19:00", "artwork_reveal")] }],
  ["Announcement Sequence", "Tease, announce, remind.", "E", "night_studio", P, { cadence: "sequence", slots: [d(0, "18:00", "thread_starter"), d(2, "18:00", "creator_announcement"), d(5, "18:00", "minimal_post")] }],
  ["Content Calendar", "Mix of formats across two weeks.", "E", "night_studio", P, { cadence: "sequence", slots: [d(0, "19:00", "question_post"), d(2, "19:00", "artwork_reveal"), d(4, "19:00", "recommendation_card"), d(7, "19:00", "poll_introduction"), d(9, "19:00", "weekly_recap")] }],
  ["Campaign Planner", "Six posts building up to a launch.", "L", "night_studio", P, { cadence: "sequence", slots: [0, 2, 4, 6, 8, 10].map((i) => d(i, "18:30", i === 10 ? "creator_announcement" : "project_update")) }],
  ["Custom Schedule", "Pick your own times and drafts.", "C", "night_studio", F, { cadence: "custom", slots: [] }],
]);

// 19 Pro Preview Lab. Only experiments that work in this build. Each is a
// preview tool in the Lab; "toggle" ones can be switched on for yourself and
// are off by default. Nothing in the Lab changes your settings on its own.
export type LabP = { tool: string; toggle?: boolean };
export const labs = mk<LabP>("lab", [
  ["Live Ring Preview", "Try every ring on your own avatar, live.", "U", "prototype_lab", F, { tool: "ring" }],
  ["Banner Animation Preview", "Watch animated banners at full size.", "U", "prototype_lab", F, { tool: "banner" }],
  ["Theme Preview", "Preview any theme across a sample screen.", "U", "prototype_lab", F, { tool: "theme" }],
  ["Profile Layout Preview", "See your real profile in each layout.", "R", "prototype_lab", F, { tool: "layout" }],
  ["Reaction Preview", "Fire every reaction style.", "U", "prototype_lab", F, { tool: "reaction" }],
  ["Badge Display Preview", "See badges next to your name.", "U", "prototype_lab", F, { tool: "badge" }],
  ["Chat Theme Preview", "See a sample conversation in each chat theme.", "U", "prototype_lab", F, { tool: "chat" }],
  ["Nameplate Preview", "Your name in every nameplate.", "U", "prototype_lab", F, { tool: "nameplate" }],
  ["Particle Preview", "Run any ambient effect for a few seconds.", "R", "prototype_lab", F, { tool: "effect" }],
  ["Transition Preview", "Play page transitions on demand.", "R", "prototype_lab", F, { tool: "transition" }],
  ["Collection Cover Preview", "See every cover style on your own collections.", "U", "prototype_lab", F, { tool: "cover" }],
  ["Creator Dashboard Preview", "See each dashboard filled with your real numbers.", "R", "prototype_lab", F, { tool: "dashboard" }],
  ["Interest Hub Preview", "Open any hub before pinning it.", "U", "prototype_lab", F, { tool: "hub" }],
  ["Profile Timeline Preview", "See your milestone timeline as others will.", "R", "prototype_lab", F, { tool: "timeline" }],
  ["Seasonal Cosmetic Preview", "Preview the current season's set together.", "E", "prototype_lab", P, { tool: "season" }, "experimental"],
  ["New Theme Preview", "Build a theme from one colour and preview it (Theme Forge+).", "E", "prototype_lab", P, { tool: "forge" }, "experimental"],
  ["Experimental Effects", "Turn on effects still being tuned (Void Distortion, Shattered Glass). Off by default.", "E", "prototype_lab", P, { tool: "experimental", toggle: true }, "experimental"],
  ["Cosmetic Bundle Preview", "Wear a whole signature look at once.", "R", "prototype_lab", F, { tool: "bundle" }],
  ["Future Collection Preview", "Collections that are designed but not yet in the catalog. Look only.", "E", "prototype_lab", P, { tool: "future" }, "experimental"],
  ["Customization Sandbox", "Mix any items from the whole catalog on a sample profile.", "L", "prototype_lab", F, { tool: "sandbox" }],
]);

// 20 Pro Membership Hub. The hub's own views. Free to open: anyone can see
// what Pro includes and what they own.
export type HubViewP = { view: string; icon: string };
export const hubViews = mk<HubViewP>("hubview", [
  ["Membership Overview", "Your plan, status and what's included.", "C", "membership", F, { view: "overview", icon: "☾" }],
  ["Owned Cosmetics", "Everything you can equip right now.", "C", "membership", F, { view: "owned", icon: "✦" }],
  ["Equipped Items", "What you're wearing, slot by slot.", "C", "membership", F, { view: "equipped", icon: "◉" }],
  ["Saved Themes", "Themes you've built and saved.", "C", "membership", F, { view: "themes", icon: "◐" }],
  ["Featured Collections", "The named sets.", "C", "membership", F, { view: "collections", icon: "❖" }],
  ["New Arrivals", "Items added in the latest catalog update.", "C", "membership", F, { view: "new", icon: "✧" }],
  ["Recommended Cosmetics", "Items that match what you already wear.", "C", "membership", F, { view: "recommended", icon: "♡" }],
  ["Seasonal Collection", "This season's featured set.", "C", "membership", F, { view: "season", icon: "❄" }],
  ["Cosmetic Categories", "All 20 categories.", "C", "membership", F, { view: "categories", icon: "▦" }],
  ["Search and Filters", "Find anything in the catalog.", "C", "membership", F, { view: "search", icon: "⌕" }],
  ["Wishlist", "Items you've saved for later.", "C", "membership", F, { view: "wishlist", icon: "☆" }],
  ["Recently Viewed", "Items you've looked at lately (kept on this device).", "C", "membership", F, { view: "recent", icon: "↺" }],
  ["Item Preview", "A full-size preview of any item.", "C", "membership", F, { view: "preview", icon: "◎" }],
  ["Collection Completion", "How much of each set you own.", "C", "membership", F, { view: "completion", icon: "▣" }],
  ["Membership Benefits", "What Pro adds and what stays free.", "C", "membership", F, { view: "benefits", icon: "✓" }],
  ["Feature Availability", "What's available, experimental, or not built yet.", "C", "membership", F, { view: "availability", icon: "◇" }],
  ["Membership Status", "Active, comp, expired or none, and until when.", "C", "membership", F, { view: "status", icon: "●" }],
  ["Billing Information", "How you paid, and when your Pro runs out.", "C", "membership", F, { view: "billing", icon: "¤" }],
  ["Cancellation Guidance", "How cancelling will work and what you keep.", "C", "membership", F, { view: "cancel", icon: "↩" }],
  ["Updates and Announcements", "Catalog and Pro news.", "C", "membership", F, { view: "updates", icon: "✉" }],
]);
