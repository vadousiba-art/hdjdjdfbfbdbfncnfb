// "Can a 17 y/o get 1,000 people on his own app in 30 days?" (my-story/YORU-GOAL-1.md)
// Four versions of the same takes. Cuts live in cut.json (scripts/cut.py); this file holds
// what goes on top: the hook, captions and inserts, anchored to words by clip + word index.
import type { HookStyle } from "../brand-lab/parts";

export type At = { clip: string; i: number } | { clip: string; start: true };
// a caption: words [from, to] of a clip, the text shown (case and fixes included), its keyword
export type Line = [number, number, string, string?];

export type Event =
  | { type: "app"; at: At }
  | { type: "counter"; stage: "now" | "goal"; at: At }
  | { type: "count"; n: number; red?: boolean; at: At }
  | { type: "face"; at: At }
  | { type: "cta"; at: At; chipAt: At; sub: string }
  | { type: "broll"; at: At; until: At; fromMs: number };

export type Version = { id: string; hook: { style: HookStyle; lines: string[]; until?: At }; events: Event[] };

// the real numbers, said on camera on Nov 4
export const PEOPLE = 14;
export const GOAL = 1000;

export const LINES: Record<string, Line[]> = {
  C142: [[0, 4, "can a 17-year-old", "17-year-old"], [5, 6, "get a"], [7, 8, "thousand people", "thousand"], [9, 10, "on his"], [11, 13, "social media app", "app"], [14, 15, "in just"], [16, 17, "30 days?", "30"], [18, 19, "damn well,", "damn"], [20, 22, "sure hope so,"], [23, 25, "because i'm trying."]],
  C121: [[1, 3, "i'm so cooked.", "cooked."]],
  C125: [[2, 4, "my name's Ethan"], [5, 7, "and i've been"], [8, 9, "building a"], [10, 12, "social media platform", "platform"], [13, 15, "every single night", "night"], [16, 18, "for the past"], [19, 20, "four weeks", "four"], [21, 21, "continuously."]],
  C130: [[2, 4, "it's called YORU,", "YORU,"], [5, 7, "and currently we"], [8, 10, "only have about"], [11, 12, "14 people", "14"], [13, 14, "on it."]],
  C131: [[0, 2, "so the goal"], [3, 5, "is 1,000 people", "1,000"], [6, 8, "by the end"], [9, 10, "of November.", "November."]],
  C132: [[2, 4, "that's 30 days...", "30"], [5, 5, "wait..."], [6, 6, "fu—", "fu—"]],
  C134: [[0, 1, "oh, so"], [2, 3, "my bad."], [4, 6, "it turns out"], [7, 8, "it's only"], [9, 10, "25 days.", "25"]],
  C136: [[0, 2, "if you want"], [3, 5, "to check out"], [6, 8, "the social media"], [9, 10, "comment NIGHT", "NIGHT"], [11, 13, "i'll send it"], [14, 15, "to you."], [16, 18, "i just really"], [19, 20, "need it, bro", "bro"]],
  C138: [[0, 2, "if you want"], [3, 4, "the link"], [5, 6, "comment NIGHT", "NIGHT"], [7, 8, "in the"], [9, 10, "comment section,"], [11, 12, "i fucking", "fucking"], [13, 15, "desperately need this."]],
};

const APP: Event = { type: "app", at: { clip: "C130", i: 4 } };
const NOW: Event = { type: "counter", stage: "now", at: { clip: "C130", i: 11 } };
const GOALCARD: Event = { type: "counter", stage: "goal", at: { clip: "C131", i: 3 } };
const D30: Event = { type: "count", n: 30, at: { clip: "C132", i: 3 } };
const D25: Event = { type: "count", n: 25, red: true, at: { clip: "C134", i: 9 } };
const BROLL: Event = { type: "broll", at: { clip: "C125", i: 13 }, until: { clip: "C125", i: 16 }, fromMs: 3000 };
const end138: Event[] = [{ type: "face", at: { clip: "C138", start: true } }, { type: "cta", at: { clip: "C138", i: 5 }, chipAt: { clip: "C138", i: 6 }, sub: "I'll send you the link" }];
const end136: Event[] = [{ type: "face", at: { clip: "C136", start: true } }, { type: "cta", at: { clip: "C136", i: 9 }, chipAt: { clip: "C136", i: 10 }, sub: "I'll send it to you" }];

export const VERSIONS: Version[] = [
  {
    // V1, main: the script in order, ending on the "I fucking desperately need this" take
    id: "v1",
    hook: { style: "white", lines: ["Can a 17 y/o get 1,000 people", "on his own app in 30 days?"], until: { clip: "C121", start: true } },
    events: [BROLL, APP, NOW, GOALCARD, D30, D25, ...end138],
  },
  {
    // V2, cold open: the laugh and "I'm so cooked" first, then the question; black-box hook
    id: "v2",
    hook: { style: "black", lines: ["I'm 17 and I need 1,000 people", "on my app in 30 days"], until: { clip: "C125", start: true } },
    events: [BROLL, APP, NOW, GOALCARD, D30, D25, ...end136],
  },
  {
    // V3, number first: "we only have about 14 people on it" opens it; the counter is the hook
    id: "v3",
    hook: { style: "plain", lines: ["14 people → 1,000", "in 30 days?"] },
    events: [NOW, GOALCARD, { type: "face", at: { clip: "C142", start: true } }, BROLL, D30, D25, ...end138],
  },
  {
    // V4, fast: no laugh, no intro, no walk (about 26 s)
    id: "v4",
    hook: { style: "white", lines: ["Day 0: 14 people on my app.", "Goal: 1,000 by Nov 30."], until: { clip: "C130", start: true } },
    events: [APP, NOW, GOALCARD, D30, D25, ...end136],
  },
];
