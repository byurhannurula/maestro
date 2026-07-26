import type { FolderEntry } from "@/lib/types";

/**
 * Pure shaping helpers for the Music Folder Browser (PRD §6.6) — kept separate
 * from `folder.ts` (which is `server-only` + does the fs I/O) so the sort and
 * path-segment logic is unit-testable. Mirrors the `dedupe.ts` / `query.ts`
 * split convention.
 */

/** Split a library-relative path into breadcrumb segments. Root ("") → []. */
export function breadcrumbs(rel: string): Array<{ name: string; rel: string }> {
  const parts = rel.split("/").filter(Boolean);
  const out: Array<{ name: string; rel: string }> = [];
  let acc = "";
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    out.push({ name: p, rel: acc });
  }
  return out;
}

/** Sort entries: directories first, then alphabetically (case-insensitive). */
export function sortEntries<T extends FolderEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/**
 * Join a current directory rel with a child name into the child's rel.
 * Root + "Artist" → "Artist"; "Artist/Album" + "Track.mp3" → "Artist/Album/Track.mp3".
 */
export function joinRel(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}
