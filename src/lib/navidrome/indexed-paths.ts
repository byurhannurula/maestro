import type { Song } from "@/lib/types";

/**
 * Pure path-index logic — deliberately free of `server-only` and any I/O, so
 * it's unit-testable. Cross-references the real `./music` folder listing with
 * Navidrome's tag index so the Folder Browser (PRD §6.6) can flag files that
 * aren't indexed.
 *
 * The Native API returns the *physical* path on `Song.path` (the Subsonic API
 * returns a tag-derived path that does NOT match disk — see `native.ts`), so
 * this is the only correct source for the "indexed by Navidrome?" flag.
 */

/**
 * Build a lookup Set of indexed physical paths from a flat song list.
 * Paths are normalised to forward slashes + leading-slash-stripped so the
 * comparison is robust against platform separator / leading "." differences
 * between the readdir listing and the Native API's `Song.path`.
 */
export function buildIndexedPaths(songs: Song[]): Set<string> {
  const out = new Set<string>();
  for (const s of songs) {
    if (!s.path) continue;
    const norm = normalisePath(s.path);
    if (norm) out.add(norm);
  }
  return out;
}

/** Normalise a path for index comparison: forward slashes, no leading slash. */
export function normalisePath(p: string): string {
  let r = p.trim().replace(/\\/g, "/");
  // Strip a single leading slash (Native API paths are usually absolute inside
  // the container, e.g. "/music/Artist/Album/Track.mp3" → "Artist/Album/...").
  if (r.startsWith("/")) r = r.slice(1);
  // Drop a leading "music/" segment if the path was absolute under MUSIC_DIR.
  if (r.startsWith("music/")) r = r.slice(6);
  return r;
}

/** True when a given library-relative path is in the index. */
export function isIndexed(index: Set<string>, rel: string): boolean {
  return index.has(normalisePath(rel));
}

/** Mark each entry with `indexed: boolean` against the supplied index. */
export function markIndexed<T extends { rel: string }>(
  entries: T[],
  index: Set<string>,
): Array<T & { indexed: boolean }> {
  return entries.map((e) => ({ ...e, indexed: isIndexed(index, e.rel) }));
}
