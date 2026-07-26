import { describe, it, expect } from "vitest";
import { breadcrumbs, joinRel, sortEntries } from "@/lib/storage/folder-shape";
import type { FolderEntry } from "@/lib/types";

function entry(name: string, rel: string, isDir: boolean): FolderEntry {
  return { name, rel, isDir };
}

const ARTIST = "Artist";
const ALBUM = "Album";
const ARTIST_REL = ARTIST;
const ALBUM_REL = `${ARTIST}/${ALBUM}`;
const TRACK_REL = `${ALBUM_REL}/Track.mp3`;
const ZTRACK = "ztrack.mp3";
const BTRACK = "Btrack.mp3";

describe("breadcrumbs", () => {
  it("returns [] at root", () => {
    expect(breadcrumbs("")).toEqual([]);
  });
  it("splits a nested path with accumulating rels", () => {
    expect(breadcrumbs(TRACK_REL)).toEqual([
      { name: ARTIST, rel: ARTIST_REL },
      { name: ALBUM, rel: ALBUM_REL },
      { name: "Track.mp3", rel: TRACK_REL },
    ]);
  });
  it("ignores empty segments (trailing slash, double slash)", () => {
    expect(breadcrumbs(`${ARTIST}//${ALBUM}/`)).toEqual([
      { name: ARTIST, rel: ARTIST_REL },
      { name: ALBUM, rel: ALBUM_REL },
    ]);
  });
});

describe("joinRel", () => {
  it("joins at root", () => {
    expect(joinRel("", ARTIST)).toBe(ARTIST);
  });
  it("joins under an existing dir", () => {
    expect(joinRel(ALBUM_REL, "Track.mp3")).toBe(TRACK_REL);
  });
});

describe("sortEntries", () => {
  it("puts directories first, then alphabetical (case-insensitive)", () => {
    const entries = [
      entry(ZTRACK, ZTRACK, false),
      entry(ALBUM, ALBUM_REL, true),
      entry(BTRACK, BTRACK, false),
      entry("artist", "artist", true),
    ];
    const sorted = sortEntries(entries);
    expect(sorted.map((e) => e.name)).toEqual([ALBUM, "artist", "Btrack.mp3", "ztrack.mp3"]);
  });
  it("is stable on equal keys", () => {
    const entries = [entry("a", "a", false), entry("a", "b", false)];
    expect(sortEntries(entries).map((e) => e.rel)).toEqual(["a", "b"]);
  });
});
