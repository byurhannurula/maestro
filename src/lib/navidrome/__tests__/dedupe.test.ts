import { describe, it, expect } from "vitest";
import {
  buildDuplicateGroups,
  keeperCompare,
  normArtist,
  normTitle,
  pruneGroups,
} from "@/lib/navidrome/dedupe";
import type { DuplicateGroup, Song } from "@/lib/types";

function song(p: Partial<Song> & { id: string }): Song {
  return {
    title: "",
    artist: "",
    album: "",
    durationSecs: 0,
    playCount: 0,
    starred: false,
    ...p,
  };
}

describe("normArtist", () => {
  it("lowercases and folds diacritics", () => {
    expect(normArtist("Beyoncé")).toBe("beyonce");
  });
  it("keeps only the primary artist, dropping feat/collab tails", () => {
    expect(normArtist("Kanye West feat. Pusha T")).toBe("kanye west");
    expect(normArtist("A, B")).toBe("a");
    expect(normArtist("A & B")).toBe("a");
  });
});

describe("normTitle", () => {
  it("strips feat clauses (parenthetical and trailing)", () => {
    expect(normTitle("Runaway (feat. Pusha T)", false)).toBe("runaway");
    expect(normTitle("Runaway feat. Pusha T", false)).toBe("runaway");
  });
  it("keeps remixes/versions distinct in conservative mode", () => {
    expect(normTitle("IDGAF", false)).not.toBe(normTitle("IDGAF (Remix)", false));
  });
  it("aggressive folds remaster/radio-edit but never remix", () => {
    expect(normTitle("Song (Remastered 2011)", true)).toBe("song");
    expect(normTitle("Song (Radio Edit)", true)).toBe("song");
    expect(normTitle("Song (Remix)", true)).toBe("song remix");
  });
});

describe("keeperCompare", () => {
  it("orders most-played first, then higher bitrate", () => {
    const a = song({ id: "a", playCount: 5, bitRate: 128 });
    const b = song({ id: "b", playCount: 1, bitRate: 320 });
    expect([b, a].sort(keeperCompare)[0].id).toBe("a");
    const c = song({ id: "c", playCount: 5, bitRate: 320 });
    expect([a, c].sort(keeperCompare)[0].id).toBe("c");
  });
});

describe("buildDuplicateGroups", () => {
  it("groups same artist+title and ignores singletons", () => {
    const songs = [
      song({ id: "1", artist: "Dua Lipa", title: "IDGAF", durationSecs: 218 }),
      song({ id: "2", artist: "Dua Lipa", title: "IDGAF", durationSecs: 231 }),
      song({ id: "3", artist: "Adele", title: "Hello", durationSecs: 200 }),
    ];
    const res = buildDuplicateGroups(songs, false, "navidrome");
    expect(res.groups).toHaveLength(1);
    expect(res.duplicateTracks).toBe(2);
    expect(res.scanned).toBe(3);
    expect(res.groups[0].versionsDiffer).toBe(true); // 218 vs 231 → > 3s
  });

  it("picks the most-played keeper and excludes it from reclaimable bytes", () => {
    const songs = [
      song({ id: "keep", artist: "X", title: "Y", playCount: 10, sizeBytes: 1000 }),
      song({ id: "dup", artist: "X", title: "Y", playCount: 0, sizeBytes: 700 }),
    ];
    const res = buildDuplicateGroups(songs, false, "navidrome");
    expect(res.groups[0].members[0].id).toBe("keep");
    expect(res.groups[0].reclaimableBytes).toBe(700);
  });
});

describe("pruneGroups", () => {
  function group(overrides: Partial<DuplicateGroup> = {}): DuplicateGroup {
    return {
      key: "artist␟title",
      artist: "Artist",
      title: "Title",
      members: [
        song({ id: "1", album: "A", bitRate: 320, sizeBytes: 10_000_000 }),
        song({ id: "2", album: "B", bitRate: 256, sizeBytes: 8_000_000 }),
        song({ id: "3", album: "C", bitRate: 192, sizeBytes: 6_000_000 }),
      ],
      versionsDiffer: false,
      reclaimableBytes: 14_000_000,
      ...overrides,
    };
  }

  it("removes specified ids and recomputes reclaimableBytes", () => {
    const g = group();
    const result = pruneGroups([g], new Set(["2"]));
    expect(result).toHaveLength(1);
    expect(result[0].members.map((m) => m.id)).toEqual(["1", "3"]);
    expect(result[0].reclaimableBytes).toBe(6_000_000);
  });

  it("drops a group when fewer than 2 copies remain", () => {
    const g = group();
    const result = pruneGroups([g], new Set(["1", "2"]));
    expect(result).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(pruneGroups([], new Set())).toEqual([]);
  });
});
