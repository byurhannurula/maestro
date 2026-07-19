import type { DataSource, DuplicateGroup, DuplicatesResult, Song } from "@/lib/types";

/**
 * Pure duplicate-detection logic — deliberately free of `server-only` and any
 * I/O, so it's unit-testable. Groups tracks whose normalised artist+title
 * collide. Remix/version qualifiers stay in the key (conservative mode), so
 * genuinely different cuts don't merge.
 */

const foldBase = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Primary-artist key: first artist only, feat/collab tails dropped. */
export function normArtist(a: string): string {
  const primary =
    foldBase(a).split(/\s*(?:,|&|;|\/|·|•|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bx\b)\s*/)[0] ?? "";
  return primary
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Non-distinguishing qualifiers stripped only in aggressive mode (these are
// usually the *same* recording). Remix/extended/instrumental/acoustic/live are
// deliberately NOT here — those are genuinely different tracks.
const AGGRESSIVE_QUALIFIERS =
  "remaster(?:ed)?(?:\\s*\\d{4})?|\\d{4}\\s*remaster(?:ed)?|radio edit|radio mix|" +
  "single version|album version|original version|mono|stereo|deluxe|bonus track|explicit|clean";

export function normTitle(t: string, aggressive: boolean): string {
  let s = foldBase(t);
  // Always drop "(feat. …)" / "[ft …]" and trailing "feat …" clutter (with or
  // without a leading dash). \b guards against words like "feature"/"defeat".
  s = s.replace(/[([{]\s*(?:feat|ft|featuring)\b[^)\]}]*[)\]}]/g, " ");
  s = s.replace(/\s+(?:[-–—]\s*)?(?:feat|ft|featuring)\b\.?\s.*$/g, " ");
  if (aggressive) {
    const re = new RegExp(
      `[([{]\\s*(?:${AGGRESSIVE_QUALIFIERS})[^)\\]}]*[)\\]}]|\\s[-–—]\\s*(?:${AGGRESSIVE_QUALIFIERS})\\b.*$`,
      "g",
    );
    s = s.replace(re, " ");
  }
  return s
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Normalized `artist␟title` identity used for library-match + dedup grouping.
 *  Single source of truth for the separator + normalisation flags. */
export function trackKey(artist: string, title: string): string {
  return `${normArtist(artist)}␟${normTitle(title, false)}`;
}

/** Suggested keeper first: most-played, then best quality, then oldest. */
export function keeperCompare(a: Song, b: Song): number {
  return (
    b.playCount - a.playCount ||
    (b.bitRate ?? 0) - (a.bitRate ?? 0) ||
    (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0) ||
    (Date.parse(a.createdAt ?? "") || 0) - (Date.parse(b.createdAt ?? "") || 0)
  );
}

export function buildDuplicateGroups(
  all: Song[],
  aggressive: boolean,
  source: DataSource,
): DuplicatesResult {
  const map = new Map<string, Song[]>();
  for (const s of all) {
    const title = normTitle(s.title, aggressive);
    if (!title) continue; // untitled — can't match reliably
    const key = `${normArtist(s.artist)}␟${title}`;
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }

  const groups: DuplicateGroup[] = [];
  let duplicateTracks = 0;
  for (const [key, members] of map) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(keeperCompare);
    const durs = sorted.map((m) => m.durationSecs);
    const versionsDiffer = Math.max(...durs) - Math.min(...durs) > 3;
    const reclaimableBytes = sorted.slice(1).reduce((n, m) => n + (m.sizeBytes ?? 0), 0);
    groups.push({
      key,
      artist: sorted[0].artist,
      title: sorted[0].title,
      members: sorted,
      versionsDiffer,
      reclaimableBytes,
    });
    duplicateTracks += members.length;
  }
  // Most copies first, then most space reclaimable.
  groups.sort(
    (a, b) => b.members.length - a.members.length || b.reclaimableBytes - a.reclaimableBytes,
  );
  return { groups, source, scanned: all.length, duplicateTracks };
}
