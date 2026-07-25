import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatDuration,
  formatUptime,
  nowMs,
  relativeTime,
  timeAgo,
} from "@/lib/format";

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
  it("formats over an hour", () => {
    expect(formatDuration(3661)).toBe("61:01");
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
  it("handles Infinity and negative", () => {
    expect(formatBytes(Infinity)).toBe("0 B");
    expect(formatBytes(-100)).toBe("0 B");
  });
});

describe("formatUptime", () => {
  it("humanises seconds", () => {
    expect(formatUptime(0)).toBe("just started");
    expect(formatUptime(90)).toBe("1m");
    expect(formatUptime(3660)).toBe("1h 1m");
    expect(formatUptime(90_000)).toBe("1d 1h");
  });
  it("rounds to just hours when exact hours", () => {
    expect(formatUptime(7200)).toBe("2h 0m");
  });
  it("handles fractional seconds", () => {
    expect(formatUptime(75.5)).toBe("1m");
  });
});

describe("timeAgo", () => {
  const now = Date.now();
  it("returns 'just now' for very recent", () => {
    expect(timeAgo(now)).toBe("just now");
  });
  it("returns minutes ago", () => {
    expect(timeAgo(now - 60_000)).toBe("1m ago");
    expect(timeAgo(now - 5 * 60_000)).toBe("5m ago");
  });
  it("returns hours ago", () => {
    expect(timeAgo(now - 3600_000)).toBe("1h ago");
  });
  it("returns days ago", () => {
    expect(timeAgo(now - 48 * 3600_000)).toBe("2d ago");
  });
});

describe("nowMs", () => {
  it("returns a number close to Date.now()", () => {
    const a = Date.now();
    const b = nowMs();
    expect(Math.abs(b - a)).toBeLessThan(100);
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
  it("returns months ago", () => {
    expect(relativeTime("2026-04-19T12:00:00Z", now)).toBe("3mo ago");
  });
  it("returns years ago", () => {
    expect(relativeTime("2023-07-19T12:00:00Z", now)).toBe("3y ago");
  });
});
