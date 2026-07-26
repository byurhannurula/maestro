import { describe, it, expect } from "vitest";
import {
  buildIndexedPaths,
  isIndexed,
  markIndexed,
  normalisePath,
} from "@/lib/navidrome/indexed-paths";
import type { Song } from "@/lib/types";

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

const TRACK_MP3 = "Artist/Album/Track.mp3";
const ABS_TRACK = "/music/Artist/Album/Track.mp3";

describe("normalisePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalisePath("Artist\\Album\\Track.mp3")).toBe(TRACK_MP3);
  });
  it("strips a leading slash", () => {
    expect(normalisePath(ABS_TRACK)).toBe(TRACK_MP3);
  });
  it("strips a leading music/ segment from absolute container paths", () => {
    expect(normalisePath(ABS_TRACK)).toBe(TRACK_MP3);
    expect(normalisePath("music/Artist/Album/Track.mp3")).toBe(TRACK_MP3);
  });
  it("trims whitespace", () => {
    expect(normalisePath("  Artist/Album/Track.mp3  ")).toBe(TRACK_MP3);
  });
  it("returns empty string for blank input", () => {
    expect(normalisePath("   ")).toBe("");
  });
});

describe("buildIndexedPaths", () => {
  it("collects song paths, normalised", () => {
    const idx = buildIndexedPaths([
      song({ id: "1", path: ABS_TRACK }),
      song({ id: "2", path: "Artist2/Album/Track2.flac" }),
    ]);
    expect(idx.has(TRACK_MP3)).toBe(true);
    expect(idx.has("Artist2/Album/Track2.flac")).toBe(true);
  });
  it("skips songs without a path", () => {
    const idx = buildIndexedPaths([song({ id: "1" }), song({ id: "2", path: "A/B.mp3" })]);
    expect(idx.size).toBe(1);
    expect(idx.has("A/B.mp3")).toBe(true);
  });
  it("dedupes paths that normalise to the same value", () => {
    const idx = buildIndexedPaths([
      song({ id: "1", path: "/music/A/B.mp3" }),
      song({ id: "2", path: "music/A/B.mp3" }),
    ]);
    expect(idx.size).toBe(1);
  });
  it("handles backslash paths from Windows-style mounts", () => {
    const idx = buildIndexedPaths([song({ id: "1", path: "A\\B\\C.mp3" })]);
    expect(idx.has("A/B/C.mp3")).toBe(true);
  });
});

describe("isIndexed", () => {
  const idx = buildIndexedPaths([song({ id: "1", path: ABS_TRACK })]);
  it("matches a normalised relative path", () => {
    expect(isIndexed(idx, TRACK_MP3)).toBe(true);
  });
  it("matches an absolute container path", () => {
    expect(isIndexed(idx, ABS_TRACK)).toBe(true);
  });
  it("returns false for unknown paths", () => {
    expect(isIndexed(idx, "Other/Track.mp3")).toBe(false);
  });
});

describe("markIndexed", () => {
  it("annotates each entry with the indexed flag", () => {
    const idx = buildIndexedPaths([song({ id: "1", path: "A/B.mp3" })]);
    const entries = [
      { name: "B.mp3", rel: "A/B.mp3", isDir: false },
      { name: "C.mp3", rel: "A/C.mp3", isDir: false },
    ];
    const marked = markIndexed(entries, idx);
    expect(marked).toEqual([
      { name: "B.mp3", rel: "A/B.mp3", isDir: false, indexed: true },
      { name: "C.mp3", rel: "A/C.mp3", isDir: false, indexed: false },
    ]);
  });
  it("marks directories as not indexed (they aren't files)", () => {
    const idx = buildIndexedPaths([song({ id: "1", path: "A/B.mp3" })]);
    const marked = markIndexed([{ name: "A", rel: "A", isDir: true }], idx);
    expect(marked[0].indexed).toBe(false);
  });
});
