import { describe, expect, it } from "vitest";
import { norm, pickMatch } from "@/lib/import/match";
import type { Song } from "@/lib/types";

describe("norm", () => {
  it("lowercases the input", () => {
    expect(norm("Hello World")).toBe("hello world");
  });

  it("strips parenthetical and bracketed content", () => {
    expect(norm("Hello (feat. World) [remix]")).toBe("hello");
  });

  it("strips feat tails", () => {
    expect(norm("Hello feat. World")).toBe("hello");
  });

  it("collapses non-alphanumeric runs to a single space", () => {
    expect(norm("Hello—World / Test")).toBe("hello world test");
  });

  it("trims whitespace", () => {
    expect(norm("  hello  ")).toBe("hello");
  });
});

describe("pickMatch", () => {
  const candidates: Song[] = [
    {
      id: "1",
      title: "Hello",
      artist: "Adele",
      album: "25",
      durationSecs: 295,
      playCount: 100,
      starred: false,
    },
    {
      id: "2",
      title: "Hello World",
      artist: "Lady Gaga",
      album: "ASIB",
      durationSecs: 210,
      playCount: 50,
      starred: false,
    },
    {
      id: "3",
      title: "Something Else",
      artist: "Adele",
      album: "21",
      durationSecs: 240,
      playCount: 75,
      starred: false,
    },
  ];

  it("returns best match on exact title + artist overlap", () => {
    const job = { title: "Hello", artist: "Adele" } as const;
    expect(pickMatch(job as unknown as Parameters<typeof pickMatch>[0], candidates)?.id).toBe("1");
  });

  it("returns null when score is below 2", () => {
    const job = { title: "Unknown", artist: "Nobody" } as const;
    expect(pickMatch(job as unknown as Parameters<typeof pickMatch>[0], candidates)).toBeNull();
  });

  it("matches on title equality alone (score 2)", () => {
    const job = { title: "Hello", artist: "" } as const;
    expect(pickMatch(job as unknown as Parameters<typeof pickMatch>[0], candidates)?.id).toBe("1");
  });

  it("handles empty title gracefully", () => {
    const job = { title: "", artist: "Adele" } as const;
    expect(pickMatch(job as unknown as Parameters<typeof pickMatch>[0], candidates)).toBeNull();
  });
});
