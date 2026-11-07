// Matching a day's e-Transfer deposits to the payments people said they sent.
// Pure (no network, no database) so it can be tested on its own.
//
// Each waiting payment has its own exact amount (a few cents under the price),
// so a deposit total usually adds up from exactly one set of payments. People
// sometimes send the plain price instead (5.99 rather than 5.84), so each
// payment may have arrived at either amount, or not at all.
//
// The answer is about every combination that adds up to the total, not just
// one of them: someone is "paid" only if they are in all of them, "not paid"
// only if they are in none. Everyone else needs the reference code checked.
//
// Two passes. First everyone is assumed to have sent the exact amount they were
// shown (almost always true). Only if no combination of exact amounts adds up
// are plain-price payments considered too, and the result says so: allowing
// them everywhere at once would make honest days look ambiguous, because a
// plain 5.99 from one person can stand in for another person's exact amount.

export type Waiting = { id: string; amount: number; base: number };
export type Combo = { ids: string[]; atBase: string[]; sum: number };

export type Reconcile = {
  // empty: nothing waiting and nothing received
  // exact: exactly one combination adds up to the total
  // several: more than one does (see unsure)
  // none: no combination does (someone sent another amount, or money came from outside a checkout)
  // too_big: too many waiting payments to work out; confirm them one by one
  status: "empty" | "exact" | "several" | "none" | "too_big";
  total: number;
  ways: number; // how many combinations add up to the total
  paid: string[]; // in every combination
  unpaid: string[]; // in none
  unsure: string[]; // in some
  atBase: string[]; // paid the plain price in every combination
  examples: Combo[]; // up to 5 combinations
  under: Combo | null; // when nothing matches: the biggest combination below the total
  over: Combo | null; // and the smallest above it
  plainPrice: boolean; // true when the match needed someone to have sent the plain price
};

const MAX_CELLS = 6_000_000;

export function reconcile(totalCents: number, waiting: Waiting[], maxExamples = 5): Reconcile {
  const exact = solve(totalCents, waiting, false, maxExamples);
  if (exact.status !== "none") return exact;
  if (!waiting.some((w) => w.base !== w.amount)) return exact;
  const loose = solve(totalCents, waiting, true, maxExamples);
  // keep the exact-amount near misses: they explain the gap better
  return loose.status === "none" ? { ...loose, under: exact.under, over: exact.over } : loose;
}

function solve(totalCents: number, waiting: Waiting[], allowBase: boolean, maxExamples: number): Reconcile {
  const total = Math.round(totalCents);
  const base: Reconcile = {
    status: "none", total, ways: 0, paid: [], unpaid: [], unsure: [], atBase: [], examples: [], under: null, over: null, plainPrice: allowBase,
  };
  if (!Number.isFinite(total) || total < 0) return base;
  const items = waiting.map((w) => ({ ...w, base: allowBase ? w.base : w.amount, opts: allowBase && w.base !== w.amount ? [w.amount, w.base] : [w.amount] }));
  const n = items.length;
  if (n === 0) {
    return total === 0
      ? { ...base, status: "empty", ways: 1, plainPrice: false }
      : { ...base, under: { ids: [], atBase: [], sum: 0 }, over: null };
  }
  const maxSum = items.reduce((s, w) => s + Math.max(...w.opts), 0);
  const width = Math.max(total, maxSum) + 1;
  if ((n + 1) * width > MAX_CELLS) return { ...base, status: "too_big", unsure: items.map((w) => w.id) };

  // P[i][s]: ways the first i payments reach s. S[i][s]: ways payments i..n-1 reach s.
  const P: Float64Array[] = [new Float64Array(width)];
  P[0][0] = 1;
  for (let i = 0; i < n; i++) {
    const prev = P[i];
    const next = new Float64Array(width);
    for (let s = 0; s < width; s++) {
      const w = prev[s];
      if (!w) continue;
      next[s] += w; // not received
      for (const a of items[i].opts) if (s + a < width) next[s + a] += w;
    }
    P.push(next);
  }
  const S: Float64Array[] = new Array(n + 1);
  S[n] = new Float64Array(width);
  S[n][0] = 1;
  for (let i = n - 1; i >= 0; i--) {
    const after = S[i + 1];
    const here = new Float64Array(width);
    for (let s = 0; s < width; s++) {
      const w = after[s];
      if (!w) continue;
      here[s] += w;
      for (const a of items[i].opts) if (s + a < width) here[s + a] += w;
    }
    S[i] = here;
  }

  // one combination reaching `target`, walking back through P (receive-exact first, then not-received, then base)
  const build = (target: number): Combo => {
    const ids: string[] = [];
    const atBase: string[] = [];
    let s = target;
    for (let i = n - 1; i >= 0; i--) {
      const w = items[i];
      if (s - w.amount >= 0 && P[i][s - w.amount] > 0) {
        ids.push(w.id);
        s -= w.amount;
      } else if (P[i][s] > 0) {
        // not received
      } else {
        ids.push(w.id);
        atBase.push(w.id);
        s -= w.base;
      }
    }
    return { ids: ids.reverse(), atBase: atBase.reverse(), sum: target };
  };

  const ways = total < width ? P[n][total] : 0;
  if (ways === 0) {
    let under: Combo | null = null;
    for (let s = Math.min(total, width - 1); s >= 0; s--) if (P[n][s] > 0) { under = build(s); break; }
    let over: Combo | null = null;
    for (let s = total + 1; s < width; s++) if (P[n][s] > 0) { over = build(s); break; }
    return { ...base, status: "none", unsure: items.map((w) => w.id), under, over };
  }

  // how many combinations each payment is in, and how many with the plain price
  const paid: string[] = [];
  const unpaid: string[] = [];
  const unsure: string[] = [];
  const atBase: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = items[i];
    let inExact = 0;
    let inBase = 0;
    for (let s = 0; s <= total; s++) {
      const left = P[i][s];
      if (!left) continue;
      const rest = total - s - w.amount;
      if (rest >= 0) inExact += left * S[i + 1][rest];
      if (w.base !== w.amount) {
        const restB = total - s - w.base;
        if (restB >= 0) inBase += left * S[i + 1][restB];
      }
    }
    const inAny = inExact + inBase;
    if (inAny === 0) unpaid.push(w.id);
    else if (inAny >= ways) {
      paid.push(w.id);
      if (inExact === 0) atBase.push(w.id);
    } else unsure.push(w.id);
  }

  // a few distinct combinations to show
  const examples: Combo[] = [];
  const pick = (i: number, s: number, ids: string[], baseIds: string[]) => {
    if (examples.length >= maxExamples) return;
    if (i < 0) {
      if (s === 0) examples.push({ ids: [...ids].reverse(), atBase: [...baseIds].reverse(), sum: total });
      return;
    }
    const w = items[i];
    if (s - w.amount >= 0 && P[i][s - w.amount] > 0) pick(i - 1, s - w.amount, [...ids, w.id], baseIds);
    if (P[i][s] > 0) pick(i - 1, s, ids, baseIds);
    if (w.base !== w.amount && s - w.base >= 0 && P[i][s - w.base] > 0) pick(i - 1, s - w.base, [...ids, w.id], [...baseIds, w.id]);
  };
  pick(n - 1, total, [], []);

  return { ...base, status: ways === 1 ? "exact" : "several", ways, paid, unpaid, unsure, atBase, examples };
}

// "$5.84" from 584
export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// "5.84" or "5" from a typed amount; null when it isn't a money amount
export function parseDollars(input: string): number | null {
  const t = input.replace(/[$,\s]/g, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}
