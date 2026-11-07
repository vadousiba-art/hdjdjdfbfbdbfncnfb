import type { AwardKind, ReactionKind } from "./types";

export const TAGLINE_1 = "THE INTERNET AFTER DARK.";
export const TAGLINE_2 = "夜は、まだ終わらない。";

export const LOADING_LINES = [
  "Loading tonight's feed...",
  "Waiting for the next episode...",
  "Buffering the opening theme...",
  "Turning the page...",
  "Tuning the vocal synth...",
  "Checking who's still awake...",
  "Developing the next panel...",
  "Syncing with the night shift...",
];

export const randomLoading = () => LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];

export const EMPTY_LINES = {
  feed: "It's quiet tonight. Drop the first post.",
  comments: "No comments yet. Start the conversation.",
  notifications: "Nothing new. The night is calm.",
  chats: "Your next conversation starts here.",
  bookmarks: "Nothing saved yet. Bookmark posts to find them later.",
  search: "No results. Try another name, tag or word.",
  leaderboard: "No rankings yet. Opt in and start posting.",
  messages: "No messages yet. Say something.",
  stories: "No stories tonight.",
};

export const SUCCESS_TOASTS = {
  post: ["Posted.", "Your post is live."],
  comment: ["Comment posted."],
  repost: ["Reposted."],
  unrepost: ["Repost removed."],
  bookmark: ["Saved to bookmarks."],
  unbookmark: ["Removed from bookmarks."],
  report: ["Report sent. The moderators will take a look."],
  copy: ["Link copied."],
  award: ["Award given."],
};

export const pickLine = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "heart", emoji: "❤️", label: "Love" },
  { kind: "skull", emoji: "💀", label: "Dead" },
  { kind: "fire", emoji: "🔥", label: "Fire" },
  { kind: "crying", emoji: "😭", label: "Crying" },
  { kind: "clown", emoji: "🤡", label: "Clown" },
  { kind: "cap", emoji: "🧢", label: "Cap" },
  { kind: "salute", emoji: "🫡", label: "Salute" },
  { kind: "w", emoji: "🇼", label: "W" },
  { kind: "l", emoji: "🇱", label: "L" },
];
export const REACTION_EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.kind, r.emoji])) as Record<ReactionKind, string>;

export const AWARDS: { kind: AwardKind; emoji: string; label: string; blurb: string }[] = [
  { kind: "menace", emoji: "😈", label: "Certified Menace", blurb: "For outstanding chaos" },
  { kind: "war_crime", emoji: "🗡️", label: "Villain Arc", blurb: "Dark, dramatic and unforgettable" },
  { kind: "touch_grass", emoji: "🌱", label: "Touch Grass", blurb: "Please. Go outside." },
  { kind: "galaxy_brain", emoji: "🧠", label: "Galaxy Brain", blurb: "Too smart or too stupid, unclear" },
  { kind: "skill_issue", emoji: "📉", label: "Skill Issue", blurb: "Self-explanatory" },
  { kind: "ratio", emoji: "📊", label: "Ratio King", blurb: "Bodied the replies" },
];
export const AWARD_INFO = Object.fromEntries(AWARDS.map((a) => [a.kind, a])) as Record<AwardKind, (typeof AWARDS)[number]>;

export const BADGES: Record<string, { emoji: string; label: string; blurb: string }> = {
  founder: { emoji: "🏛️", label: "Founding Menace", blurb: "Started this whole mess" },
  verified: { emoji: "✅", label: "Verified", blurb: "Officially real (allegedly)" },
  first_blood: { emoji: "🩸", label: "First Blood", blurb: "Posted for the first time" },
  yapper: { emoji: "🗣️", label: "Certified Yapper", blurb: "25+ posts" },
  banger: { emoji: "💥", label: "Banger Merchant", blurb: "A post hit 10+ likes" },
  ratio_god: { emoji: "👑", label: "Ratio God", blurb: "100+ likes received" },
  roast_survivor: { emoji: "🔥", label: "Roast Survivor", blurb: "Got roasted by the Menace and lived" },
  award_magnet: { emoji: "🏆", label: "Award Magnet", blurb: "5+ community awards" },
  chaos_agent: { emoji: "🌀", label: "Chaos Agent", blurb: "50+ chaos points" },
  challenge_accepted: { emoji: "🎯", label: "Challenge Accepted", blurb: "Did a daily challenge" },
  fireproof: { emoji: "🧯", label: "Fireproof", blurb: "Opted into nuclear roasts" },
};

export const DAILY_CHALLENGES = [
  "Recommend one anime you think nobody else here has watched.",
  "Post the manga panel that lives rent-free in your head.",
  "Share the Vocaloid or J-pop track on repeat this week.",
  "Describe your week as an anime opening sequence.",
  "Who is the most underrated side character of all time?",
  "Share something you drew, edited or made recently.",
  "Your comfort show for 3am. Go.",
  "Rate the last thing you watched out of 10 — no explanations.",
  "Post your current desktop or phone wallpaper.",
  "Which opening theme would play when you walk into a room?",
  "Drop a game soundtrack that deserves more love.",
  "Pitch an anime crossover that should exist.",
  "Your villain origin story in one sentence.",
  "Share a meme that only this community would understand.",
];

export function todaysChallenge(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  return DAILY_CHALLENGES[day % DAILY_CHALLENGES.length];
}

export const TICKER = [
  "Tonight on YORU: find your people",
  "Anime · Manga · Vocaloid · J-music · Gaming · Art · Memes",
  "夜は、まだ終わらない。",
];

export const STORY_BG: Record<string, string> = {
  lime: "linear-gradient(160deg,#1a1a1a,#080808)",
  pink: "linear-gradient(160deg,var(--brand),color-mix(in srgb,var(--brand) 38%,black))",
  purple: "linear-gradient(160deg,#2a2a2a,#0d0d0d)",
  blue: "linear-gradient(160deg,color-mix(in srgb,var(--brand) 22%,#111),#080808)",
  fire: "linear-gradient(160deg,var(--ring-b),color-mix(in srgb,var(--brand) 12%,black))",
  void: "radial-gradient(circle at 30% 20%,#262626,#080808)",
};

export const INTENSITY = [
  { level: 1 as const, name: "Mild", emoji: "🌶️", blurb: "Playful teasing" },
  { level: 2 as const, name: "Spicy", emoji: "🌶️🌶️", blurb: "Savage but affectionate" },
  { level: 3 as const, name: "Nuclear", emoji: "☢️", blurb: "Unhinged. No survivors." },
];

export const NOTIFICATION_TEXT: Record<string, string> = {
  like: "liked your post",
  reaction: "reacted to your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  mention: "mentioned you",
  repost: "reposted your post",
  award: "gave your post an award",
  message: "sent you a message",
  friend_post: "posted something",
  new_post: "posted",
  follow: "started following you",
  top_post: "has a top post right now",
  roast: "roasted you",
  announcement: "posted an announcement",
  system: "sent you a notice",
  moderation: "· Night Watch",
  report_update: "· update on your report",
};

export const ERROR_TITLES = ["Something went wrong.", "Lost in the dark.", "That didn't load."];

export const CATEGORIES = [
  { tag: "anime", label: "Anime", jp: "アニメ" },
  { tag: "manga", label: "Manga", jp: "漫画" },
  { tag: "music", label: "Music", jp: "音楽" },
  { tag: "vocaloid", label: "Vocaloid", jp: "ボカロ" },
  { tag: "gaming", label: "Gaming", jp: "ゲーム" },
  { tag: "art", label: "Art", jp: "アート" },
  { tag: "memes", label: "Memes", jp: "ミーム" },
  { tag: "random", label: "Random", jp: "雑談" },
];
