import { describe, expect, it } from "vitest";
import { dedupeTrackCandidates, dedupeArtistCandidates } from "@/lib/discovery/candidates";

describe("dedupeTrackCandidates", () => {
  it("returns candidates sorted by match descending", async () => {
    const result = await dedupeTrackCandidates(
      [{ artist: "Adele", title: "Hello" }],
      async () => [
        { artist: "Adele", title: "Skyfall", match: 0.9 },
        { artist: "Adele", title: "Rolling", match: 0.8 },
        { artist: "Adele", title: "Someone", match: 0.95 },
      ],
      new Set(),
    );
    expect(result.map((c) => c.title)).toEqual(["Someone", "Skyfall", "Rolling"]);
  });

  it("skips tracks already in libKeys", async () => {
    const result = await dedupeTrackCandidates(
      [{ artist: "Adele", title: "Hello" }],
      async () => [
        { artist: "Adele", title: "Skyfall" },
        { artist: "Adele", title: "Rolling" },
      ],
      new Set(["adele␟skyfall"]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Rolling");
  });

  it("keeps the higher match when two seeds suggest the same track", async () => {
    const result = await dedupeTrackCandidates(
      [
        { artist: "A", title: "X" },
        { artist: "B", title: "Y" },
      ],
      async (s) =>
        s.title === "X"
          ? [{ artist: "Common", title: "Track", match: 0.5 }]
          : [{ artist: "Common", title: "Track", match: 0.9 }],
      new Set(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].match).toBeCloseTo(0.9);
    expect(result[0].reason).toBe("Similar to Y");
  });

  it("returns empty when all candidates are in library", async () => {
    const result = await dedupeTrackCandidates(
      [{ artist: "A", title: "X" }],
      async () => [{ artist: "A", title: "B" }],
      new Set(["a␟b"]),
    );
    expect(result).toHaveLength(0);
  });

  it("returns empty for empty seeds", async () => {
    const result = await dedupeTrackCandidates([], async () => [], new Set());
    expect(result).toHaveLength(0);
  });

  it("handles empty similar results", async () => {
    const result = await dedupeTrackCandidates(
      [{ artist: "A", title: "X" }],
      async () => [],
      new Set(),
    );
    expect(result).toHaveLength(0);
  });

  it("caps at 18 results", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      artist: "A",
      title: `Track ${i}`,
      match: 1 - i / 100,
    }));
    const result = await dedupeTrackCandidates(
      [{ artist: "A", title: "Seed" }],
      async () => many,
      new Set(),
    );
    expect(result).toHaveLength(18);
  });

  it("sets reason to Similar to {seed title}", async () => {
    const result = await dedupeTrackCandidates(
      [{ artist: "A", title: "MySeed" }],
      async () => [{ artist: "B", title: "Result" }],
      new Set(),
    );
    expect(result[0].reason).toBe("Similar to MySeed");
  });
});

describe("dedupeArtistCandidates", () => {
  it("returns candidates sorted by match descending", async () => {
    const result = await dedupeArtistCandidates(
      ["Adele"],
      async () => [
        { name: "Amy Winehouse", match: 0.9 },
        { name: "Duffy", match: 0.7 },
        { name: "Sia", match: 0.95 },
      ],
      new Set(),
    );
    expect(result.map((a) => a.name)).toEqual(["Sia", "Amy Winehouse", "Duffy"]);
  });

  it("skips seed artists", async () => {
    const result = await dedupeArtistCandidates(
      ["Adele"],
      async () => [{ name: "Adele", match: 0.99 }],
      new Set(),
    );
    expect(result).toHaveLength(0);
  });

  it("skips duplicates across seeds", async () => {
    const result = await dedupeArtistCandidates(
      ["A", "B"],
      async (s) =>
        s === "A" ? [{ name: "Common", match: 0.5 }] : [{ name: "Common", match: 0.9 }],
      new Set(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Common");
  });

  it("marks inLibrary when owned set contains normalized name", async () => {
    const result = await dedupeArtistCandidates(
      ["A"],
      async () => [{ name: "Beyoncé", match: 0.9 }],
      new Set(["beyonce"]),
    );
    expect(result[0].inLibrary).toBe(true);
  });

  it("marks inLibrary false when artist not owned", async () => {
    const result = await dedupeArtistCandidates(
      ["A"],
      async () => [{ name: "New Artist", match: 0.5 }],
      new Set(),
    );
    expect(result[0].inLibrary).toBe(false);
  });

  it("returns empty for empty seeds", async () => {
    const result = await dedupeArtistCandidates([], async () => [], new Set());
    expect(result).toHaveLength(0);
  });

  it("caps at 8 results", async () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      name: `Artist ${i}`,
      match: 1 - i / 100,
    }));
    const result = await dedupeArtistCandidates(["Seed"], async () => many, new Set());
    expect(result).toHaveLength(8);
  });

  it("sets basedOn to the seed artist name", async () => {
    const result = await dedupeArtistCandidates(
      ["Adele"],
      async () => [{ name: "Sia", match: 0.9 }],
      new Set(),
    );
    expect(result[0].basedOn).toBe("Adele");
  });
});
