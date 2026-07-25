import { describe, expect, it, vi } from "vitest";
import { lookupTrack } from "@/lib/deezer";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { DEEZER_API_URL: "https://api.deezer.com" },
}));

const mockJson = vi.fn();
vi.mock("@/lib/http", () => ({
  getJson: (...args: unknown[]) => mockJson(...args),
  trimSlash: (s: string) => s.replace(/\/$/, ""),
}));

const trackHit = (overrides = {}) => ({
  data: [
    {
      link: "https://deezer.com/track/1",
      preview: "https://cdns/preview.mp3",
      duration: 240,
      album: { title: "Album", cover_medium: "https://cdns/cover.jpg" },
      ...overrides,
    },
  ],
});

describe("lookupTrack", () => {
  it("returns match from fielded query", async () => {
    mockJson.mockResolvedValue(trackHit());
    const r = await lookupTrack("Adele", "Hello");
    expect(r).not.toBeNull();
    expect(r?.album).toBe("Album");
    expect(r?.preview).toBe("https://cdns/preview.mp3");
    expect(r?.cover).toBe("https://cdns/cover.jpg");
    expect(r?.deezerUrl).toBe("https://deezer.com/track/1");
    expect(r?.durationSecs).toBe(240);
  });

  it("falls back to loose query when fielded returns nothing", async () => {
    let call = 0;
    mockJson.mockImplementation(() => {
      call++;
      return Promise.resolve(call === 1 ? { data: [] } : trackHit());
    });
    const r = await lookupTrack("Adele", "Hello");
    expect(r).not.toBeNull();
    expect(r?.album).toBe("Album");
  });

  it("returns null when both queries miss", async () => {
    mockJson.mockResolvedValue({ data: [] });
    const r = await lookupTrack("Unknown", "Nope");
    expect(r).toBeNull();
  });

  it("returns null on API error", async () => {
    mockJson.mockRejectedValue(new Error("network error"));
    const r = await lookupTrack("Adele", "Hello");
    expect(r).toBeNull();
  });

  it("strips quotes from the query", async () => {
    mockJson.mockResolvedValue(trackHit());
    await lookupTrack(`A"de"le`, `He"llo"`);
    const url = decodeURIComponent(mockJson.mock.calls[0][0] as string);
    expect(url).toContain('artist:"Adele"');
    expect(url).toContain('track:"Hello"');
  });

  it("handles missing album/cover/preview gracefully", async () => {
    mockJson.mockResolvedValue({ data: [{}] });
    const r = await lookupTrack("A", "B");
    expect(r).not.toBeNull();
    expect(r?.album).toBeUndefined();
    expect(r?.cover).toBeUndefined();
    expect(r?.preview).toBeUndefined();
  });

  it("handles empty data array", async () => {
    mockJson.mockResolvedValue({ data: [] });
    const r = await lookupTrack("A", "B");
    expect(r).toBeNull();
  });
});
