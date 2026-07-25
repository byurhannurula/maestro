import type { LbPlaylistMeta } from "./index";

const MBID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function mbidFrom(identifier: unknown): string {
  const url = Array.isArray(identifier) ? identifier[0] : identifier;
  if (typeof url !== "string") return "";
  return url.match(MBID_RE)?.[0] ?? "";
}

const PRIORITY = ["weekly exploration", "weekly jams", "daily jams"];

export function cleanKind(title: string): string {
  const base = title.split(/\s+for\s+/i)[0].trim();
  return base || "Recommended";
}

export function dateOf(date: unknown, title: string): number {
  if (typeof date === "string") {
    const d = Date.parse(date);
    if (!Number.isNaN(d)) return d;
  }
  const m = title.match(/week of (\d{4}-\d{2}-\d{2})/i);
  if (m) {
    const d = Date.parse(m[1]);
    if (!Number.isNaN(d)) return d;
  }
  return 0;
}

interface ParsedItem {
  mbid: string;
  title: string;
  kind: string;
  date: number;
}

export function parseAndDedupePlaylists(
  raw: Array<{ playlist?: { identifier?: unknown; title?: unknown; date?: unknown } }>,
): LbPlaylistMeta[] {
  const parsed: ParsedItem[] = [];
  for (const it of raw) {
    const pl = it.playlist ?? {};
    const title = typeof pl.title === "string" ? pl.title : "Recommended";
    const mbid = mbidFrom(pl.identifier);
    if (!mbid) continue;
    parsed.push({
      mbid,
      title,
      kind: cleanKind(title),
      date: dateOf(pl.date, title),
    });
  }
  parsed.sort((a, b) => b.date - a.date);

  const seen = new Set<string>();
  const out: LbPlaylistMeta[] = [];
  for (const p of parsed) {
    const k = p.kind.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ mbid: p.mbid, title: p.title, kind: p.kind });
  }
  out.sort((a, b) => {
    const ia = PRIORITY.indexOf(a.kind.toLowerCase());
    const ib = PRIORITY.indexOf(b.kind.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return out.slice(0, 8);
}
