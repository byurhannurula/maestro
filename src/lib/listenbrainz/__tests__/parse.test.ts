import { describe, expect, it } from "vitest";
import { cleanKind, dateOf, mbidFrom, parseAndDedupePlaylists } from "@/lib/listenbrainz/parse";

const DAILY_JAMS = "Daily Jams";
const ISO_DATE = "2026-07-20T00:00:00Z";

describe("mbidFrom", () => {
  it("extracts an MBID from a MusicBrainz URL", () => {
    expect(mbidFrom("https://musicbrainz.org/playlist/6b3a8e40-9e3d-4e8c-9f0a-2c8e9f0a2c8e")).toBe(
      "6b3a8e40-9e3d-4e8c-9f0a-2c8e9f0a2c8e",
    );
  });

  it("takes the first MBID from an array", () => {
    expect(
      mbidFrom([
        "https://musicbrainz.org/playlist/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "https://other.url/xxx",
      ]),
    ).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("returns empty string for non-string input", () => {
    expect(mbidFrom(123)).toBe("");
    expect(mbidFrom(null)).toBe("");
    expect(mbidFrom(undefined)).toBe("");
  });

  it("returns empty string when no MBID pattern found", () => {
    expect(mbidFrom("just a regular url")).toBe("");
  });

  it("returns empty string for non-string objects (not called as a string)", () => {
    const obj = { toString: () => "https://musicbrainz.org/playlist/eee-eee" };
    expect(mbidFrom(obj)).toBe("");
  });
});

describe("cleanKind", () => {
  it("strips the 'for user, week of …' suffix", () => {
    expect(cleanKind("Weekly Exploration for byrhn, week of 2026-07-20")).toBe(
      "Weekly Exploration",
    );
  });

  it("returns 'Recommended' for untitled playlists", () => {
    expect(cleanKind("")).toBe("Recommended");
  });

  it("keeps the title when there is no 'for' suffix", () => {
    expect(cleanKind(DAILY_JAMS)).toBe(DAILY_JAMS);
  });

  it("strips 'for' suffix even without a trailing date", () => {
    expect(cleanKind("A for B")).toBe("A");
  });

  it("strips different locale formats", () => {
    expect(cleanKind("Weekly Jams for user, week of 2026-07-20")).toBe("Weekly Jams");
  });
});

describe("dateOf", () => {
  it("parses an ISO date string", () => {
    expect(dateOf(ISO_DATE, "")).toBe(new Date(ISO_DATE).getTime());
  });

  it("falls back to 'week of' in title when date is missing", () => {
    expect(dateOf(null, "Weekly Jams for byrhn, week of 2026-06-15")).toBe(
      new Date("2026-06-15").getTime(),
    );
  });

  it("returns 0 when no date is parseable", () => {
    expect(dateOf("not-a-date", "no date here")).toBe(0);
  });
});

describe("parseAndDedupePlaylists", () => {
  it("returns newest of each recurring kind in priority order", () => {
    const raw = [
      {
        playlist: {
          identifier: "https://musicbrainz.org/playlist/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          title: "Weekly Exploration for user, week of 2026-07-20",
          date: ISO_DATE,
        },
      },
      {
        playlist: {
          identifier: "https://musicbrainz.org/playlist/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          title: "Weekly Exploration for user, week of 2026-07-13",
          date: "2026-07-13T00:00:00Z",
        },
      },
      {
        playlist: {
          identifier: "https://musicbrainz.org/playlist/cccccccc-cccc-cccc-cccc-cccccccccccc",
          title: "Daily Jams for user, week of 2026-07-20",
          date: ISO_DATE,
        },
      },
      {
        playlist: {
          identifier: "https://musicbrainz.org/playlist/dddddddd-dddd-dddd-dddd-dddddddddddd",
          title: "Weekly Jams for user, week of 2026-07-13",
          date: "2026-07-13T00:00:00Z",
        },
      },
    ];

    const result = parseAndDedupePlaylists(raw);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe("Weekly Exploration");
    expect(result[0].mbid).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(result[1].kind).toBe("Weekly Jams");
    expect(result[2].kind).toBe("Daily Jams");
  });

  it("filters out items without an MBID", () => {
    const raw = [
      { playlist: { identifier: "not-an-mbid", title: "Some Mix" } },
      {
        playlist: {
          identifier: "https://musicbrainz.org/playlist/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
          title: "Real Mix",
        },
      },
    ];
    expect(parseAndDedupePlaylists(raw)).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(parseAndDedupePlaylists([])).toEqual([]);
  });

  it("handles missing playlist wrapper", () => {
    const raw = [{ playlist: undefined }];
    expect(parseAndDedupePlaylists(raw)).toEqual([]);
  });
});
