import { describe, expect, it, vi } from "vitest";
import { asArray } from "@/lib/lastfm";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { LASTFM_API_URL: "https://ws.audioscrobbler.com/2.0/", LASTFM_API_KEY: "test-key" },
}));
vi.mock("@/lib/http", () => ({
  getJson: vi.fn(),
}));

describe("asArray", () => {
  it("returns the array when input is an array", () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("wraps a truthy non-array in an array", () => {
    expect(asArray({ name: "X" })).toEqual([{ name: "X" }]);
  });

  it("wraps a string in an array", () => {
    expect(asArray("hello")).toEqual(["hello"]);
  });

  it("returns empty array for null", () => {
    expect(asArray(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it("returns empty array for empty input array", () => {
    expect(asArray([])).toEqual([]);
  });

  it("handles nested array of objects", () => {
    const items = [
      { name: "A", match: 0.9 },
      { name: "B", match: 0.5 },
    ];
    expect(asArray(items)).toEqual(items);
  });
});
