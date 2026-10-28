import { describe, expect, it } from "vitest";
import { calculateStreak } from "@robo/shared/analytics";

describe("calculateStreak", () => {
  it("counts consecutive active days ending today", () => {
    expect(calculateStreak(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"], "2026-10-23")).toBe(4);
  });

  it("keeps yesterday's streak alive before today's first activity", () => {
    expect(calculateStreak(["2026-10-21", "2026-10-22"], "2026-10-23")).toBe(2);
  });

  it("stops at the first missing day", () => {
    expect(calculateStreak(["2026-10-19", "2026-10-21", "2026-10-22"], "2026-10-23")).toBe(2);
  });

  it("returns zero with no activity", () => {
    expect(calculateStreak([], "2026-10-23")).toBe(0);
  });
});
