import { describe, expect, it } from "vitest";
import { norm, pickMatch } from "@/lib/import/match";
import type { Song } from "@/lib/types";

function asJob(j: { title?: string; artist?: string }) {
  return j as Parameters<typeof pickMatch>[0];
}

const HW = "Hello World";

describe("norm", () => {
  it("lowercases the input", () => {
    expect(norm(HW)).toBe("hello world");
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

  it("strips various feat variants", () => {
    expect(norm("Song (feat. Guest) [ft. Another]")).toBe("song");
    expect(norm("Artist - Song (ft. Guest)")).toBe("artist song");
  });

  it("strips all parenthetical content, not just feat", () => {
    expect(norm(`${HW} (radio edit)`)).toBe("hello world");
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
      title: HW,
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
  const match = (j: ReturnType<typeof asJob>) => pickMatch(j, candidates);

  it.each([
    [{ title: "Hello", artist: "Adele" }, "1"],
    [{ title: "Hello", artist: "" }, "1"],
    [{ title: "Hello World", artist: "" }, "2"],
  ] as const)("matches job %j to candidate %s", (job, expected) => {
    expect(match(asJob(job))?.id).toBe(expected);
  });

  it.each([
    [{ title: "Unknown", artist: "Nobody" }],
    [{ title: "", artist: "Adele" }],
    [{ title: "KXYZ", artist: "Adele" }],
  ] as const)("returns null for job %j", (job) => {
    expect(match(asJob(job))).toBeNull();
  });

  it("handles feat-stripped job title against bare candidate", () => {
    const c2: Song[] = [
      {
        id: "m1",
        title: "Song",
        artist: "Artist",
        album: "A",
        durationSecs: 200,
        playCount: 0,
        starred: false,
      },
    ];
    const j = asJob({ title: "Song (feat. Guest)", artist: "Artist" });
    expect(pickMatch(j, c2)?.id).toBe("m1");
  });
});
