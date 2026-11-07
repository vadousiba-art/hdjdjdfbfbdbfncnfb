import { describe, expect, it } from "vitest";
import { brandDir, seasonAt } from "@/lib/season";

describe("seasonal brand art", () => {
  it("runs Halloween from Oct 15 to Nov 2, Alberta time", () => {
    expect(seasonAt(new Date("2026-10-14T12:00:00-06:00"))).toBeNull();
    expect(seasonAt(new Date("2026-10-15T00:30:00-06:00"))).toBe("halloween");
    expect(seasonAt(new Date("2026-10-31T23:00:00-06:00"))).toBe("halloween");
    expect(seasonAt(new Date("2026-11-02T23:30:00-07:00"))).toBe("halloween");
    expect(seasonAt(new Date("2026-11-03T00:30:00-07:00"))).toBeNull();
    // 03:00 UTC on Nov 3 is still Nov 2 in Edmonton.
    expect(seasonAt(new Date("2026-11-03T03:00:00Z"))).toBe("halloween");
  });

  it("points at the season's folder, or the normal art", () => {
    expect(brandDir("halloween")).toBe("/brand/yoru/halloween");
    expect(brandDir(null)).toBe("/brand/yoru");
  });
});
