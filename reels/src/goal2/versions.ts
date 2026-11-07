// Day 2 of "1,000 people on my app" (my-story/YORU-GOAL-2.md). Five versions of the same takes.
// Cuts: cut.json (scripts/cut.py). Here: the hook, captions and inserts, anchored to words.
import type { HookStyle } from "../brand-lab/parts";

export type At = { clip: string; i: number } | { clip: string; start: true };
export type Line = [number, number, string, string?];

export type Event =
  | { type: "counter"; at: At }
  | { type: "goal"; at: At }
  | { type: "days"; at: At }
  | { type: "rec"; src: string; at: At }
  | { type: "face"; at: At }
  | { type: "cta"; at: At; title: string; sub: string; chip?: string; chipAt?: At }
  | { type: "broll"; at: At; until: At; fromMs: number };

export type Version = { id: string; hook: { style: HookStyle; lines: string[]; until?: At }; events: Event[] };

// the real numbers: 14 on Day 0, 22 in the Members tab when these were filmed (Nov 5)
export const BEFORE = 14;
export const NOW = 22;
export const GOAL = 1000;
export const DAYS_LEFT = 24;

export const LINES: Record<string, Line[]> = {
  C149: [[0, 2, "it's day two.", "two."], [3, 5, "yesterday i said"], [6, 8, "i would get"], [9, 10, "1,000 people", "1,000"], [11, 12, "on my"], [13, 15, "social media app", "app"], [16, 18, "by the end"], [19, 20, "of November.", "November."], [21, 22, "let's see"], [23, 25, "how it's going."]],
  C157: [[0, 2, "look at this,"], [3, 3, "guys!"], [4, 5, "we have"], [6, 8, "22 people now!", "22"]],
  C162: [[0, 1, "holy shit,", "shit,"], [2, 4, "look at this,"], [5, 6, "we got"], [7, 9, "22 people now.", "22"]],
  C164: [[0, 0, "bro,"], [1, 2, "22 people!", "22"]],
  C165: [[0, 0, "bro,"], [1, 2, "22 people,", "22"], [3, 4, "we have"], [5, 6, "22 now", "22"]],
  C166: [[0, 2, "and you see"], [3, 5, "the video got"], [6, 7, "600 views,", "600"], [8, 9, "only 600,"], [10, 11, "and that's"], [12, 13, "how many"], [14, 16, "we've gotten overnight", "overnight"]],
  C170: [[0, 2, "this is insane,", "insane,"], [3, 3, "guys,"], [4, 6, "we only need"], [7, 8, "972 people,", "972"], [9, 10, "and then"], [11, 12, "guess what?"], [13, 14, "we have"], [15, 17, "a thousand users!", "thousand"]],
  C176: [[0, 2, "so, that means"], [3, 5, "we need only"], [6, 8, "972 more users", "972"], [9, 10, "in just"], [11, 12, "24 days.", "24"]],
  C183: [[0, 2, "and i will"], [3, 4, "be building"], [5, 7, "exactly one feature", "one"], [8, 8, "tomorrow."], [9, 9, "whatever"], [10, 12, "you guys want,"], [13, 14, "comment it", "comment"], [15, 16, "down below."], [17, 18, "person with"], [19, 21, "the most likes,", "likes,"], [22, 24, "i'll build it."]],
  C191: [[0, 2, "and if you"], [3, 5, "want to be"], [6, 8, "in the app,"], [9, 10, "comment NIGHT", "NIGHT"], [11, 13, "and i'll send"], [14, 15, "the link"], [16, 17, "to you."]],
  C198: [[0, 2, "if you're not"], [3, 5, "yet on it,"], [6, 7, "comment NIGHT", "NIGHT"], [8, 10, "and i will"], [11, 12, "send you"], [13, 14, "the link"], [15, 16, "down below."]],
  C207: [[0, 2, "and if you"], [3, 5, "are not yet"], [6, 8, "on the app,"], [9, 10, "comment NIGHT", "NIGHT"], [11, 13, "and i'll send"], [14, 16, "you the link"], [17, 18, "down below."]],
};

const COUNT: Event = { type: "counter", at: { clip: "C166", start: true } };
const NOTIF: Event = { type: "rec", src: "notif-blur", at: { clip: "C166", i: 10 } };
const BUILD: Event[] = [
  { type: "face", at: { clip: "C183", start: true } },
  { type: "broll", at: { clip: "C183", i: 3 }, until: { clip: "C183", i: 9 }, fromMs: 1500 },
];
const night = (clip: string, comment: number): Event[] => [
  { type: "face", at: { clip, start: true } },
  { type: "cta", at: { clip, i: comment }, chipAt: { clip, i: comment + 1 }, title: "Comment the word", sub: "I'll send you the link", chip: "NIGHT" },
];

export const VERSIONS: Version[] = [
  {
    // V1, main: intro, the "holy shit" reveal, 600 views with the new posts rolling, the feature promise, NIGHT
    id: "v1",
    hook: { style: "white", lines: ["Day 2: did anyone actually", "join my app?"], until: { clip: "C162", start: true } },
    events: [COUNT, NOTIF, ...BUILD, ...night("C198", 6)],
  },
  {
    // V2, reveal first: "holy shit" opens it, then the intro, the 24-days stakes
    id: "v2",
    hook: { style: "black", lines: ["Day 2: 14 → 22 people", "on my app"], until: { clip: "C149", start: true } },
    events: [{ type: "counter", at: { clip: "C149", i: 21 } }, { type: "days", at: { clip: "C176", i: 6 } }, ...BUILD, ...night("C191", 9)],
  },
  {
    // V3, the optimist: "bro, 22 people", "guess what? we have a thousand users"
    id: "v3",
    hook: { style: "plain", lines: ["Day 2 of getting 1,000 people", "on my own app"], until: { clip: "C164", start: true } },
    events: [{ type: "counter", at: { clip: "C170", start: true } }, { type: "goal", at: { clip: "C170", i: 9 } }, ...BUILD, ...night("C207", 9)],
  },
  {
    // V4, fast (about 12 s): "look at this guys", 600 views, NIGHT
    id: "v4",
    hook: { style: "white", lines: ["Day 2: 14 → 22"], until: { clip: "C166", start: true } },
    events: [COUNT, NOTIF, ...night("C198", 6)],
  },
  {
    // V5, you pick what I build: ends on the feature vote instead of NIGHT
    id: "v5",
    hook: { style: "white", lines: ["Day 2: you pick what", "I build next"], until: { clip: "C165", start: true } },
    events: [COUNT, NOTIF, ...BUILD, { type: "cta", at: { clip: "C183", i: 13 }, title: "Comment a feature", sub: "the most liked one gets built tomorrow" }],
  },
];
