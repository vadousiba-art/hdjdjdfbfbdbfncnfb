// Day 3 of "1,000 people on my app" (my-story/YORU-GOAL-3.md): "I built my own algorithm".
// Cuts: cut.json (scripts/cut.py). Here: the hooks, captions and inserts, anchored to words.
// C260 ("isn't like any other social media platform to have ever existed") is left out on
// purpose: it's a claim we can't back up.
import type { HookStyle } from "../brand-lab/parts";

export type At = { clip: string; i: number } | { clip: string; start: true };
export type Line = [number, number, string, string?];

export type Event =
  | { type: "first"; at: At }                      // a first post meeting its first audience
  | { type: "climb"; at: At }                      // the five Moonrise phases
  | { type: "face"; at: At }                       // back to the full frame
  | { type: "cta"; at: At; title: string; sub: string; chip?: string; chipAt?: At };

export type Version = { id: string; hook: { style: HookStyle; lines: string[]; until?: At }; events: Event[] };

// the real number: people on YORU (not bots, not banned) in the production database, Nov 7
export const NOW = 29;
export const GOAL = 1000;

// when the first post's audience fills in, and when the climb reaches each phase
export const AUDIENCE = { from: { clip: "C259", i: 7 } as At, to: { clip: "C259", i: 19 } as At, more: { clip: "C259", i: 20 } as At };
export const PHASES: At[] = [
  { clip: "C264", start: true },  // New Moon
  { clip: "C264", i: 8 },         // "watch": Crescent
  { clip: "C264", i: 12 },        // "post": Half Moon
  { clip: "C264", i: 15 },        // "grow": Full Moon
  { clip: "C269", i: 15 },        // "rise": Blood Moon
];

export const LINES: Record<string, Line[]> = {
  C256: [[0, 2, "it's day three", "three"], [3, 5, "and i decided"], [6, 8, "to do something"], [9, 10, "a little"], [11, 12, "fucking crazy.", "crazy."]],
  C258: [[0, 2, "i spent my"], [3, 4, "beautiful night.", "night."], [5, 7, "i could have"], [8, 9, "been sleeping.", "sleeping."], [10, 12, "i'm building a"], [13, 14, "goddamn algorithm!", "algorithm!"]],
  C259: [[0, 1, "now on"], [2, 3, "my app,", "app,"], [4, 6, "every single post,", "post,"], [7, 9, "every single person,", "person,"], [10, 12, "everyone that's new,", "new,"], [13, 14, "gets a"], [15, 16, "solid shot", "shot"], [17, 19, "at being seen", "seen"], [20, 22, "by the world.", "world."]],
  C261: [[0, 1, "you see,"], [2, 3, "followers don't", "followers"], [4, 4, "decide."], [5, 6, "money does", "money"], [7, 8, "not decide."], [9, 11, "the only people"], [12, 14, "that decide on"], [15, 16, "this social"], [17, 18, "media platform"], [19, 20, "is you", "you"], [21, 23, "and you only.", "you"]],
  C264: [[0, 2, "and the greatest", "greatest"], [3, 5, "thing about it"], [6, 8, "you can watch", "watch"], [9, 10, "your videos,"], [11, 12, "your post,"], [13, 14, "your feed"], [15, 15, "grow", "grow"], [16, 17, "in real"], [18, 19, "fucking time", "time"]],
  C269: [[0, 2, "post your videos,", "videos,"], [3, 5, "post your images,", "images,"], [6, 8, "and post anything", "anything"], [9, 11, "your heart desires", "heart"], [12, 13, "and watch"], [14, 15, "it rise.", "rise."]],
  C271: [[0, 1, "comment NIGHT", "NIGHT"], [2, 3, "down below"], [4, 6, "and i'll send"], [7, 9, "you the link"]],
};

const FIRST: Event = { type: "first", at: { clip: "C259", start: true } };
const FACE: Event = { type: "face", at: { clip: "C261", start: true } };
const CLIMB: Event = { type: "climb", at: { clip: "C264", start: true } };
const NIGHT: Event[] = [
  { type: "face", at: { clip: "C271", start: true } },
  { type: "cta", at: { clip: "C271", start: true }, chipAt: { clip: "C271", i: 1 }, title: "Comment the word", sub: "I'll send you the link", chip: "NIGHT" },
];

export const VERSIONS: Version[] = [
  {
    // V1, main: the number and the new idea in the hook
    id: "v1",
    hook: { style: "white", lines: [`Day 3: ${NOW} / 1,000 people`, "so I built my own algorithm"], until: { clip: "C258", start: true } },
    events: [FIRST, FACE, CLIMB, ...NIGHT],
  },
  {
    // V2: the idea alone, black boxes
    id: "v2",
    hook: { style: "black", lines: ["Day 3: I built my", "own algorithm"], until: { clip: "C258", start: true } },
    events: [FIRST, FACE, CLIMB, ...NIGHT],
  },
  {
    // V3: the promise to the viewer
    id: "v3",
    hook: { style: "white", lines: ["On my app, followers don't", "decide who sees your post"], until: { clip: "C258", start: true } },
    events: [FIRST, FACE, CLIMB, ...NIGHT],
  },
  {
    // V4, fast (about 22 s): day three, every post gets a shot, you decide, NIGHT
    id: "v4",
    hook: { style: "white", lines: [`Day 3: ${NOW} / 1,000 people`, "so I built my own algorithm"], until: { clip: "C259", start: true } },
    events: [FIRST, FACE, ...NIGHT],
  },
];
