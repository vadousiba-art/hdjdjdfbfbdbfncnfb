import { describe, expect, it } from "vitest";
import { parseDollars, reconcile, type Waiting } from "@/lib/billing/etransfer";

const pro = (id: string, amount: number): Waiting => ({ id, amount, base: 599 });

// Every way the deposits could have happened, by brute force: exact amounts
// first, and the plain price as well only when exact amounts can't add up.
function brute(total: number, ws: Waiting[]) {
  const exact = bruteWith(total, ws, false);
  return exact.length ? exact : bruteWith(total, ws, true);
}
function bruteWith(total: number, ws: Waiting[], allowBase: boolean) {
  const combos: { ids: string[]; atBase: string[] }[] = [];
  const go = (i: number, sum: number, ids: string[], atBase: string[]) => {
    if (i === ws.length) {
      if (sum === total) combos.push({ ids, atBase });
      return;
    }
    const w = ws[i];
    go(i + 1, sum, ids, atBase);
    go(i + 1, sum + w.amount, [...ids, w.id], atBase);
    if (allowBase && w.base !== w.amount) go(i + 1, sum + w.base, [...ids, w.id], [...atBase, w.id]);
  };
  go(0, 0, [], []);
  return combos;
}

describe("matching deposits to payments", () => {
  it("names who paid and who didn't when one combination fits", () => {
    const r = reconcile(598 + 596, [pro("amy", 598), pro("ben", 597), pro("cal", 596)]);
    expect(r.status).toBe("exact");
    expect(r.paid.sort()).toEqual(["amy", "cal"]);
    expect(r.unpaid).toEqual(["ben"]);
    expect(r.unsure).toEqual([]);
  });

  it("spots someone who sent the plain price, and says so", () => {
    // with one other Pro order waiting, a plain $5.99 can only be amy's
    const r = reconcile(599 + 590, [pro("amy", 598), pro("ben", 590)]);
    expect(r.status).toBe("exact");
    expect(r.plainPrice).toBe(true);
    expect(r.paid.sort()).toEqual(["amy", "ben"]);
    expect(r.atBase).toEqual(["amy"]);
    expect(r.unpaid).toEqual([]);
  });

  it("a plain $5.99 can't say whose it was when several Pro orders wait", () => {
    // every Pro order's plain price is the same, so this is ben plus amy-or-cal
    const r = reconcile(599 + 590, [pro("amy", 598), pro("ben", 590), pro("cal", 596)]);
    expect(r.status).toBe("several");
    expect(r.paid).toEqual(["ben"]);
    expect(r.unsure.sort()).toEqual(["amy", "cal"]);
  });

  it("a plain-price payment can stand in for someone else's: it says who is certain", () => {
    // 599 + 597 is amy (plain) + ben, or ben + cal (plain)
    const r = reconcile(599 + 597, [pro("amy", 598), pro("ben", 597), pro("cal", 596)]);
    expect(r.status).toBe("several");
    expect(r.plainPrice).toBe(true);
    expect(r.paid).toEqual(["ben"]);
    expect(r.unsure.sort()).toEqual(["amy", "cal"]);
  });

  it("prefers exact amounts when they add up", () => {
    const r = reconcile(598 + 597, [pro("amy", 598), pro("ben", 597), pro("cal", 596)]);
    expect(r).toMatchObject({ status: "exact", plainPrice: false });
  });

  it("says when the total could be more than one set of people", () => {
    const r = reconcile(598 + 595, [pro("a", 598), pro("b", 597), pro("c", 596), pro("d", 595)]);
    expect(r.status).toBe("several");
    expect(r.ways).toBeGreaterThan(1);
    expect(r.paid).toEqual([]);
    expect(r.unsure.length).toBeGreaterThan(0);
    for (const ex of r.examples) expect(ex.sum).toBe(1193);
  });

  it("everyone matched", () => {
    const r = reconcile(598 + 597, [pro("a", 598), pro("b", 597)]);
    expect(r).toMatchObject({ status: "exact", ways: 1, unpaid: [], unsure: [] });
    expect(r.paid.sort()).toEqual(["a", "b"]);
  });

  it("nothing received means nobody paid", () => {
    const r = reconcile(0, [pro("a", 598), pro("b", 597)]);
    expect(r.status).toBe("exact");
    expect(r.unpaid.sort()).toEqual(["a", "b"]);
  });

  it("reports the nearest totals when nothing adds up", () => {
    const r = reconcile(1000, [pro("a", 598), pro("b", 597)]);
    expect(r.status).toBe("none");
    expect(r.under?.sum).toBe(598); // the nearest using the exact amounts people were shown
    expect(r.over?.sum).toBe(1195);
    expect(r.unsure.sort()).toEqual(["a", "b"]);
  });

  it("money with nothing waiting", () => {
    expect(reconcile(500, []).status).toBe("none");
    expect(reconcile(0, []).status).toBe("empty");
  });

  it("includes donations", () => {
    const r = reconcile(598 + 2499, [pro("a", 598), { id: "gift", amount: 2499, base: 2500 }, pro("b", 597)]);
    expect(r.status).toBe("exact");
    expect(r.paid.sort()).toEqual(["a", "gift"]);
    expect(r.unpaid).toEqual(["b"]);
  });

  it("agrees with brute force on random cases", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let k = 0; k < 300; k++) {
      const n = 1 + Math.floor(rnd() * 7);
      const ws: Waiting[] = [];
      const used = new Set<number>();
      for (let i = 0; i < n; i++) {
        let a = 599 - (1 + Math.floor(rnd() * 12));
        while (used.has(a)) a--;
        used.add(a);
        ws.push(rnd() < 0.8 ? pro(`p${i}`, a) : { id: `d${i}`, amount: 1000 - (600 - a), base: 1000 });
      }
      const pickTotal = rnd() < 0.7;
      const total = pickTotal
        ? ws.reduce((s, w) => s + (rnd() < 0.6 ? (rnd() < 0.85 ? w.amount : w.base) : 0), 0)
        : Math.floor(rnd() * 4000);
      const combos = brute(total, ws);
      const r = reconcile(total, ws);
      expect(r.ways).toBe(combos.length);
      for (const w of ws) {
        const inCount = combos.filter((c) => c.ids.includes(w.id)).length;
        if (combos.length === 0) expect(r.unsure).toContain(w.id);
        else if (inCount === 0) expect(r.unpaid).toContain(w.id);
        else if (inCount === combos.length) expect(r.paid).toContain(w.id);
        else expect(r.unsure).toContain(w.id);
      }
      for (const ex of r.examples) {
        const sum = ex.ids.reduce((s, id) => {
          const w = ws.find((x) => x.id === id)!;
          return s + (ex.atBase.includes(id) ? w.base : w.amount);
        }, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it("stays fast with a busy day", () => {
    const ws = Array.from({ length: 40 }, (_, i) => pro(`p${i}`, 598 - i));
    const t0 = performance.now();
    const r = reconcile(ws.slice(0, 25).reduce((s, w) => s + w.amount, 0), ws);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(["exact", "several"]).toContain(r.status);
  });
});

describe("reading typed amounts", () => {
  it("accepts dollars and cents", () => {
    expect(parseDollars("5.84")).toBe(584);
    expect(parseDollars("$1,234.5")).toBe(123450);
    expect(parseDollars(" 12 ")).toBe(1200);
    expect(parseDollars("0")).toBe(0);
  });
  it("rejects anything else", () => {
    expect(parseDollars("5.849")).toBeNull();
    expect(parseDollars("-5")).toBeNull();
    expect(parseDollars("five")).toBeNull();
    expect(parseDollars("")).toBeNull();
  });
});
