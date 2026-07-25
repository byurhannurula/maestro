import { expect, it } from "vitest";
import { enrichTrack } from "@/lib/discovery/enrich";
import type { DeezerMatch } from "@/lib/deezer";

const dz: DeezerMatch = {
  album: "25",
  durationSecs: 295,
  preview: "https://cdns.example/preview.mp3",
  cover: "https://cdns.example/cover.jpg",
  deezerUrl: "https://deezer.example/track/1",
};

it("maps a raw track with deezer match and in-library flag", () => {
  const r = enrichTrack({ artist: "Adele", title: "Hello" }, dz, new Set(["adele␟hello"]));
  expect(r).toMatchObject({
    id: "adele␟hello",
    title: "Hello",
    artist: "Adele",
    album: "25",
    durationSecs: 295,
    preview: "https://cdns.example/preview.mp3",
    cover: "https://cdns.example/cover.jpg",
    deezerUrl: "https://deezer.example/track/1",
    available: true,
    inLibrary: true,
  });
});

it("sets available=false and nullables when deezer is null", () => {
  const r = enrichTrack({ artist: "Unknown", title: "Lost Track" }, null, new Set());
  expect(r.available).toBe(false);
  expect(r.inLibrary).toBe(false);
  expect(r.album).toBeUndefined();
  expect(r.preview).toBeUndefined();
  expect(r.cover).toBeUndefined();
  expect(r.deezerUrl).toBeUndefined();
});

it("uses raw.durationSecs when deezer match has none", () => {
  const r = enrichTrack({ artist: "A", title: "B", durationSecs: 120 }, { album: "X" }, new Set());
  expect(r.durationSecs).toBe(120);
});

it("prefers deezer duration over raw duration", () => {
  const r = enrichTrack(
    { artist: "A", title: "B", durationSecs: 60 },
    { album: "X", durationSecs: 999 },
    new Set(),
  );
  expect(r.durationSecs).toBe(999);
});

it("uses raw.id as track id when present", () => {
  const r = enrichTrack({ artist: "A", title: "B", id: "mbid-xxx" }, null, new Set());
  expect(r.id).toBe("mbid-xxx");
});

it("falls back to trackKey when raw.id is missing", () => {
  const r = enrichTrack({ artist: "Beyoncé", title: "Halo" }, null, new Set());
  expect(r.id).toBe("beyonce␟halo");
});

it("passes through match and reason", () => {
  const r = enrichTrack(
    { artist: "A", title: "B", match: 0.85, reason: "Similar to Song X" },
    null,
    new Set(),
  );
  expect(r.match).toBeCloseTo(0.85);
  expect(r.reason).toBe("Similar to Song X");
});

it("marks inLibrary=true when trackKey exists in libKeys", () => {
  const lib = new Set(["artist␟song"]);
  const r = enrichTrack({ artist: "Artist", title: "Song" }, null, lib);
  expect(r.inLibrary).toBe(true);
});

it("marks inLibrary=false when trackKey absent from libKeys", () => {
  const r = enrichTrack({ artist: "Artist", title: "Song" }, null, new Set(["other␟key"]));
  expect(r.inLibrary).toBe(false);
});

it("handles special characters in artist/title", () => {
  const r = enrichTrack({ artist: "Mötley Crüe", title: "Kickstart My Heart" }, null, new Set());
  expect(r.id).toBe("motley crue␟kickstart my heart");
  expect(r.artist).toBe("Mötley Crüe");
  expect(r.title).toBe("Kickstart My Heart");
});
