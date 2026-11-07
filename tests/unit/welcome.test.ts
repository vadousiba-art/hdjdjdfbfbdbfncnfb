import { describe, expect, it } from "vitest";
import { WELCOME, chooseWelcome, pickSource } from "@/lib/welcome/config";
import cues from "@/lib/welcome/cues.json";
import en from "@/lib/i18n/messages/en";

describe("welcome config", () => {
  it("is valid and versioned", () => {
    expect(WELCOME).not.toBeNull();
    expect(WELCOME!.version).toMatch(/^[0-9]+/);
    expect(WELCOME!.upcoming.every((u) => u.status === "in_development")).toBe(true);
  });

  it("has a translatable caption for every on-screen line, inside the film", () => {
    for (const cut of ["full", "short"] as const) {
      for (const c of cues.cuts[cut].captions) {
        expect(en[c.key as keyof typeof en], c.key).toBeTruthy();
        expect(c.end).toBeGreaterThan(c.start);
        expect(c.end).toBeLessThanOrEqual(cues.cuts[cut].duration);
      }
    }
  });

  it("never mentions a price in the film", () => {
    const text = JSON.stringify(cues);
    expect(text).not.toMatch(/\$|5\.99|per month|USD/i);
  });
});

describe("who sees what", () => {
  it("new accounts get the full film once", () => {
    expect(chooseWelcome({ seen: null, account_age_hours: 0 }, "1")).toBe("full");
    expect(chooseWelcome({ seen: "1", account_age_hours: 0 }, "1")).toBeNull();
  });
  it("existing members get the short update for a new version", () => {
    expect(chooseWelcome({ seen: null, account_age_hours: 5000 }, "1")).toBe("short");
    expect(chooseWelcome({ seen: "1", account_age_hours: 5000 }, "2")).toBe("short");
  });
  it("shows nothing without state", () => {
    expect(chooseWelcome(null, "1")).toBeNull();
  });
});

describe("source choice", () => {
  const cut = WELCOME!.full;
  it("uses portrait files on tall screens and landscape files on wide ones, in both formats", () => {
    const tall = pickSource(cut, { width: 400, height: 860, dpr: 3, saveData: false, slow: false });
    expect(tall.webm).toMatch(/full-port\.webm$/);
    expect(tall.mp4).toMatch(/full-port\.mp4$/);
    expect(tall.portrait).toBe(true);
    const wide = pickSource(cut, { width: 1440, height: 900, dpr: 1, saveData: true, slow: false });
    expect(wide.mp4).toMatch(/full-land\.mp4$/);
    expect(wide.poster).toMatch(/poster-land\.jpg$/);
  });
});
