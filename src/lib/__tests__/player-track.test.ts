import { describe, expect, it } from "vitest";
import { libraryTrack, previewTrack } from "@/lib/player-track";
import type { Song } from "@/lib/types";

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

describe("libraryTrack", () => {
  it("creates a PlayerTrack from a Song", () => {
    const s = song("abc123", { title: "Hello", artist: "Adele", coverArt: "ca-1" });
    const t = libraryTrack(s);
    expect(t.id).toBe("abc123");
    expect(t.title).toBe("Hello");
    expect(t.artist).toBe("Adele");
    expect(t.src).toBe("/api/stream?id=abc123");
    expect(t.coverArt).toBe("ca-1");
    expect(t.source).toBe("library");
  });

  it("encodes the id in the stream URL", () => {
    const t = libraryTrack(song("a/b?c"));
    expect(t.src).toContain(encodeURIComponent("a/b?c"));
  });

  it("uses song.starred when no starred argument given", () => {
    const s = song("1", { starred: true });
    expect(libraryTrack(s).starred).toBe(true);
  });

  it("prefers explicit starred argument over song.starred", () => {
    const s = song("1", { starred: false });
    expect(libraryTrack(s, true).starred).toBe(true);
    const s2 = song("2", { starred: true });
    expect(libraryTrack(s2, false).starred).toBe(false);
  });
});

describe("previewTrack", () => {
  it("creates a preview PlayerTrack with all fields", () => {
    const t = previewTrack(
      "p-1",
      "Preview",
      "https://dz.example/audio.mp3",
      "Artist",
      "https://dz.example/cover.jpg",
    );
    expect(t.id).toBe("p-1");
    expect(t.title).toBe("Preview");
    expect(t.artist).toBe("Artist");
    expect(t.src).toBe("/api/preview?url=https%3A%2F%2Fdz.example%2Faudio.mp3");
    expect(t.coverUrl).toBe("https://dz.example/cover.jpg");
    expect(t.source).toBe("preview");
  });

  it("works without optional artist and coverUrl", () => {
    const t = previewTrack("p-2", "No Artist", "https://dz.example/track.mp3");
    expect(t.artist).toBeUndefined();
    expect(t.coverUrl).toBeUndefined();
  });

  it("encodes the preview URL", () => {
    const t = previewTrack("p-3", "X", "https://dz.example/audio?param=value&other=1");
    expect(t.src).toBe(
      "/api/preview?url=https%3A%2F%2Fdz.example%2Faudio%3Fparam%3Dvalue%26other%3D1",
    );
  });
});
