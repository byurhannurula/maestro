import { describe, it, expect } from "vitest";
import { safeRelPath } from "@/lib/storage/paths";

const ROOT = "/music";

describe("safeRelPath", () => {
  it("resolves a library-relative path under root", () => {
    expect(safeRelPath("Artist - Album/01.mp3", ROOT)).toBe("/music/Artist - Album/01.mp3");
  });
  it("accepts an absolute path already inside root", () => {
    expect(safeRelPath("/music/a/b.mp3", ROOT)).toBe("/music/a/b.mp3");
  });
  it("normalises harmless inner ..", () => {
    expect(safeRelPath("a/b/../c.mp3", ROOT)).toBe("/music/a/c.mp3");
  });
  it("rejects ../ traversal", () => {
    expect(safeRelPath("../etc/passwd", ROOT)).toBeNull();
    expect(safeRelPath("a/../../etc", ROOT)).toBeNull();
  });
  it("rejects an absolute path outside root", () => {
    expect(safeRelPath("/etc/passwd", ROOT)).toBeNull();
  });
});
