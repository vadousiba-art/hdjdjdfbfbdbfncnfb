// The motivation reel ("Nobody's coming"): which words stack together, line by line.
// Every word points at the a-roll's edit.json by (segment, word index in its take), so a
// word appears on the exact frame it's said. Segments, from src/motivation/cut.json:
//   0 the hook take, 1 C216, 2 C219, 3 the "Nobody's coming" callback, 4 C224, 5-6 C225
// "s" lines are the small connector lines, "b" the big ones; a word marked red is the
// block's one YORU-red word. Text is what was actually said, in capitals.

export type Word = { seg: number; i: number; text: string; red?: boolean };
export type Line = { size: "s" | "b"; words: Word[] };
export type Block = Line[];

const w = (seg: number, i: number, text: string, red = false): Word => ({ seg, i, text, red });
const s = (...words: Word[]): Line => ({ size: "s", words });
const b = (...words: Word[]): Line => ({ size: "b", words });

const HOOK_C211: Block[] = [
  [b(w(0, 0, "LISTEN!", true))],
  [s(w(0, 1, "NOBODY'S"), w(0, 2, "COMING")), s(w(0, 3, "TO"), w(0, 4, "GIVE"), w(0, 5, "YOU")), b(w(0, 6, "PERMISSION.", true))],
];
const HOOK_C212: Block[] = [
  [b(w(0, 0, "LISTEN,", true))],
  [s(w(0, 1, "NOBODY"), w(0, 2, "IS"), w(0, 3, "COMING")), s(w(0, 4, "TO"), w(0, 5, "GIVE"), w(0, 6, "YOU")), b(w(0, 7, "PERMISSION.", true))],
];
const HOOK_C215: Block[] = [
  [b(w(0, 0, "NOBODY")), s(w(0, 1, "IS"), w(0, 2, "COMING")), s(w(0, 3, "TO"), w(0, 4, "GIVE"), w(0, 5, "YOU")), b(w(0, 6, "PERMISSION.", true))],
];

// the callback: "Nobody is coming." (from C215, or from C212 in the version whose hook is C215)
const callback = (first: number): Block => [s(w(3, first, "NOBODY"), w(3, first + 1, "IS")), b(w(3, first + 2, "COMING.", true))];

const body = (cb: Block): Block[] => [
  [s(w(1, 0, "SO"), w(1, 1, "YOUR"), w(1, 2, "FIRST"), w(1, 3, "VERSION")), s(w(1, 4, "WILL"), w(1, 5, "BE")), b(w(1, 6, "EMBARRASSING,", true))],
  [s(w(1, 7, "BUT"), w(1, 8, "YOU'LL"), w(1, 9, "POST"), w(1, 10, "IT")), b(w(1, 11, "ANYWAY,", true))],
  [s(w(1, 12, "BECAUSE"), w(1, 13, "WAITING")), s(w(1, 14, "FOR"), w(1, 15, "PERFECT")), s(w(1, 16, "IS"), w(1, 17, "JUST")), b(w(1, 18, "QUITTING")), b(w(1, 19, "SLOWLY.", true))],
  [b(w(2, 0, "CRINGE")), b(w(2, 1, "BEATS")), b(w(2, 2, "NEVER.", true))],
  cb,
  [s(w(4, 0, "AND"), w(4, 1, "THAT'S")), b(w(4, 2, "THE"), w(4, 3, "BEST"), w(4, 4, "NEWS", true)), s(w(4, 5, "YOU"), w(4, 6, "WILL"), w(4, 7, "EVER"), w(4, 8, "RECEIVE,"))],
  [s(w(4, 9, "BECAUSE"), w(4, 10, "THE"), w(4, 11, "ONLY"), w(4, 12, "PERSON")), s(w(4, 13, "YOU"), w(4, 14, "ARE"), w(4, 15, "WAITING"), w(4, 16, "ON")), b(w(4, 17, "IS"), w(4, 18, "YOU.", true))],
  [s(w(5, 0, "SHIP"), w(5, 1, "IT")), b(w(5, 2, "TONIGHT.", true))],
];

export type Version = { id: string; label: string; blocks: Block[] };

export const VERSIONS: Version[] = [
  { id: "v1", label: "Hook C211 (\"Listen!\"), red night (main)", blocks: [...HOOK_C211, ...body(callback(0))] },
  { id: "v2", label: "Hook C212 (\"Listen,\"), red night", blocks: [...HOOK_C212, ...body(callback(0))] },
  { id: "v3", label: "Hook C215 (no \"Listen\"), red night", blocks: [...HOOK_C215, ...body(callback(1))] },
  { id: "v4", label: "Hook C211, blue night (look test)", blocks: [...HOOK_C211, ...body(callback(0))] },
];

export const HANDLE = "@ethan_lang__founder";
export const CARD_SECONDS = 1.6; // the black end card after the a-roll (the boom)
