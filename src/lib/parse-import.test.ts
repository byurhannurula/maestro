import { describe, expect, it } from "vitest";
import { parseImportLine, parseImportList } from "./parse-import";

describe("parseImportLine", () => {
  it("splits a simple 'Artist - Title' line", () => {
    const r = parseImportLine("Dua Lipa - IDGAF");
    expect(r).toMatchObject({
      kind: "query",
      artists: ["Dua Lipa"],
      primaryArtist: "Dua Lipa",
      title: "IDGAF",
      searchQuery: "Dua Lipa IDGAF",
    });
  });

  it("keeps only the first of multiple comma-separated artists as primary", () => {
    const r = parseImportLine("Ocean Park Standoff,Lil Yachty - If You Were Mine");
    expect(r?.artists).toEqual(["Ocean Park Standoff", "Lil Yachty"]);
    expect(r?.primaryArtist).toBe("Ocean Park Standoff");
    expect(r?.searchQuery).toBe("Ocean Park Standoff If You Were Mine");
  });

  it("splits on the FIRST ' - ' so titles keep their own ' - '", () => {
    const r = parseImportLine("Finish Ticket - Color - Remastered");
    expect(r?.primaryArtist).toBe("Finish Ticket");
    expect(r?.title).toBe("Color - Remastered");
    // "- Remastered" stripped from the search query, artist preserved.
    expect(r?.searchQuery).toBe("Finish Ticket Color");
  });

  it("preserves remix info but strips feat clutter", () => {
    const r = parseImportLine(
      "Jon Batiste,Jon Bellion,Fireboy DML - Drink Water (feat. Jon Bellion and Fireboy DML)",
    );
    expect(r?.primaryArtist).toBe("Jon Batiste");
    expect(r?.searchQuery).toBe("Jon Batiste Drink Water");
  });

  it("keeps remix qualifiers in the title", () => {
    const r = parseImportLine(
      "Miike Snow,Louis The Child - Genghis Khan - Louis the Child Remix",
    );
    expect(r?.title).toBe("Genghis Khan - Louis the Child Remix");
    expect(r?.searchQuery).toContain("Louis the Child Remix");
  });

  it("treats a Deezer URL as a direct link", () => {
    const r = parseImportLine("https://www.deezer.com/track/3135556");
    expect(r).toMatchObject({ kind: "url", url: "https://www.deezer.com/track/3135556" });
  });

  it("falls back to a free-text query when there is no separator", () => {
    const r = parseImportLine("BUNT. Crown");
    expect(r?.kind).toBe("query");
    expect(r?.searchQuery).toBe("BUNT. Crown");
  });

  it("ignores blank lines and comments", () => {
    expect(parseImportLine("   ")).toBeNull();
    expect(parseImportLine("# a comment")).toBeNull();
  });
});

describe("parseImportList", () => {
  it("parses a real multi-line export, skipping blanks", () => {
    const text = [
      "BLESSED - Insanity",
      "",
      "Dua Lipa - IDGAF",
      "Two Door Cinema Club,RAC - Next Year (RAC Remix)",
    ].join("\n");
    const rows = parseImportList(text);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.primaryArtist)).toEqual([
      "BLESSED",
      "Dua Lipa",
      "Two Door Cinema Club",
    ]);
    // Remix qualifier retained on the last row.
    expect(rows[2].searchQuery).toContain("RAC Remix");
  });
});
