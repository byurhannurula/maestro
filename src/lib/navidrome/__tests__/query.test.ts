import { describe, expect, it } from "vitest";
import { applyStaleCutoff, compareBy, processInMemory } from "@/lib/navidrome/query";
import type { Song, SongQuery } from "@/lib/types";

const now = Date.now();

function song(id: string, overrides: Partial<Song> = {}): Song {
  return {
    id,
    title: "Test",
    artist: "Artist",
    album: "Album",
    durationSecs: 200,
    playCount: 0,
    starred: false,
    ...overrides,
  };
}

describe("applyStaleCutoff", () => {
  it("returns all songs when no days provided", () => {
    const songs = [song("1"), song("2")];
    expect(applyStaleCutoff(songs)).toHaveLength(2);
  });

  it("drops songs created after the cutoff", () => {
    const old = song("1", { createdAt: new Date(now - 10 * 86_400_000).toISOString() });
    const recent = song("2", { createdAt: new Date(now - 86_400_000).toISOString() });
    const result = applyStaleCutoff([old, recent], 7);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("keeps songs with no createdAt", () => {
    const songs = [song("1")];
    expect(applyStaleCutoff(songs, 7)).toHaveLength(1);
  });
});

describe("compareBy", () => {
  const songs = [
    song("1", { title: "Alpha", playCount: 10, createdAt: "2026-01-01" }),
    song("2", { title: "Beta", playCount: 5, createdAt: "2026-02-01" }),
  ];

  it("sorts ASC by title", () => {
    const sorted = [...songs].sort(compareBy("title", "ASC"));
    expect(sorted[0].id).toBe("1");
  });

  it("sorts DESC by title", () => {
    const sorted = [...songs].sort(compareBy("title", "DESC"));
    expect(sorted[0].id).toBe("2");
  });

  it("sorts by playCount", () => {
    const sorted = [...songs].sort(compareBy("playCount", "DESC"));
    expect(sorted[0].id).toBe("1");
    expect(sorted[0].playCount).toBe(10);
  });

  it("sorts by createdAt", () => {
    const sorted = [...songs].sort(compareBy("createdAt", "DESC"));
    expect(sorted[0].id).toBe("2");
  });
});

describe("processInMemory", () => {
  const songs = [
    song("1", { title: "Alpha", artist: "X", album: "A", playCount: 10, starred: true }),
    song("2", { title: "Beta", artist: "Y", album: "B", playCount: 5, starred: false }),
    song("3", { title: "Gamma", artist: "X", album: "C", playCount: 3, starred: false }),
  ];

  const query: SongQuery = { start: 0, end: 10, sort: "title", order: "ASC" };

  it("returns all songs sorted with no filters", () => {
    const result = processInMemory(songs, query);
    expect(result.songs.map((s) => s.id)).toEqual(["1", "2", "3"]);
    expect(result.total).toBe(3);
  });

  it("filters by search term across title/artist/album", () => {
    const result = processInMemory(songs, query, "beta");
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe("2");
  });

  it("filters by favoritesOnly", () => {
    const result = processInMemory(songs, { ...query, favoritesOnly: true });
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe("1");
  });

  it("paginates", () => {
    const result = processInMemory(songs, { ...query, start: 0, end: 2 });
    expect(result.songs).toHaveLength(2);
    expect(result.total).toBe(3);
  });
});
