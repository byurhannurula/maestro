import { describe, it, expect } from "vitest";
import { formatBytes, formatDuration, formatUptime, relativeTime } from "@/lib/format";

describe("formatDuration", () => {
  it("formats mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3599)).toBe("59:59");
  });
  it("guards invalid input", () => {
    expect(formatDuration(-1)).toBe("0:00");
    expect(formatDuration(Number.NaN)).toBe("0:00");
  });
});

describe("formatBytes", () => {
  it("scales through units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });
});

describe("formatUptime", () => {
  it("humanises seconds", () => {
    expect(formatUptime(0)).toBe("just started");
    expect(formatUptime(90)).toBe("1m");
    expect(formatUptime(3660)).toBe("1h 1m");
    expect(formatUptime(90_000)).toBe("1d 1h");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-07-19T12:00:00Z");
  it("handles missing / invalid", () => {
    expect(relativeTime(undefined, now)).toBe("—");
    expect(relativeTime("not-a-date", now)).toBe("—");
  });
  it("buckets by age", () => {
    expect(relativeTime("2026-07-19T10:00:00Z", now)).toBe("today");
    expect(relativeTime("2026-07-18T10:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-07-10T12:00:00Z", now)).toBe("9d ago");
  });
});
