// Seasonal brand art. Each season has a window (in Alberta time, where YORU
// is made) and turns itself off afterwards, so nothing needs undoing by hand.
export type Season = "halloween";

const WINDOWS: { season: Season; from: [number, number]; to: [number, number] }[] = [
  { season: "halloween", from: [10, 15], to: [11, 2] },
];

export function seasonAt(date: Date = new Date()): Season | null {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", month: "numeric", day: "numeric" }).formatToParts(date);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const today = month * 100 + day;
  const hit = WINDOWS.find(({ from, to }) => today >= from[0] * 100 + from[1] && today <= to[0] * 100 + to[1]);
  return hit?.season ?? null;
}

const BASE = "/brand/yoru";

/** Where the logo and icon files for the current season live. */
export function brandDir(season: Season | null = seasonAt()): string {
  return season ? `${BASE}/${season}` : BASE;
}
