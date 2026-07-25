import type { Song, SongQuery, SongSortKey } from "@/lib/types";

export function applyStaleCutoff(songs: Song[], days?: number): Song[] {
  if (!days || days <= 0) return songs;
  const cutoff = Date.now() - days * 86_400_000;
  return songs.filter((s) => !s.createdAt || Date.parse(s.createdAt) <= cutoff);
}

export function compareBy(sort: SongSortKey, order: "ASC" | "DESC") {
  const dir = order === "ASC" ? 1 : -1;
  const val = (s: Song): string | number => {
    switch (sort) {
      case "playCount":
        return s.playCount;
      case "createdAt":
        return s.createdAt ? Date.parse(s.createdAt) : 0;
      case "lastPlayed":
        return s.lastPlayed ? Date.parse(s.lastPlayed) : 0;
      default:
        return s[sort].toLowerCase();
    }
  };
  return (a: Song, b: Song) => {
    const av = val(a);
    const bv = val(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  };
}

export function processInMemory(
  all: Song[],
  q: SongQuery,
  search?: string,
): { songs: Song[]; total: number } {
  let rows = all;
  if (search) {
    const needle = search.toLowerCase();
    rows = rows.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.artist.toLowerCase().includes(needle) ||
        s.album.toLowerCase().includes(needle),
    );
  }
  if (q.favoritesOnly) rows = rows.filter((s) => s.starred);
  rows = [...rows].sort(compareBy(q.sort, q.order));
  return { songs: rows.slice(q.start, q.end), total: rows.length };
}
