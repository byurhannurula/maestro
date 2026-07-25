import { describe, expect, it } from "vitest";
import { coverGradient } from "@/lib/cover-gradient";

describe("coverGradient", () => {
  it("returns one of the defined gradient classes", () => {
    const valid = [
      "from-emerald-500 to-teal-700",
      "from-violet-500 to-fuchsia-700",
      "from-sky-500 to-indigo-700",
      "from-amber-500 to-orange-700",
      "from-rose-500 to-pink-700",
      "from-lime-500 to-emerald-700",
      "from-cyan-500 to-blue-700",
    ];
    for (const seed of ["abc", "xyz", "playlist-1", "artist-2", "track-3", ""]) {
      expect(valid).toContain(coverGradient(seed));
    }
  });

  it("is deterministic — same seed always returns same gradient", () => {
    const seed = "weekly-exploration";
    expect(coverGradient(seed)).toBe(coverGradient(seed));
    expect(coverGradient("")).toBe(coverGradient(""));
  });

  it("returns different results for different seeds", () => {
    const results = new Set(["a", "b", "c", "d"].map(coverGradient));
    expect(results.size).toBeGreaterThan(1);
  });

  it("handles unicode seeds without crashing", () => {
    const result = coverGradient("Björk / Бьорк");
    expect(result).toMatch(/^from-\w+-500 to-\w+-700$/);
  });

  it("handles very long seeds", () => {
    const result = coverGradient("a".repeat(1000));
    expect(result).toMatch(/^from-\w+-500 to-\w+-700$/);
  });
});
