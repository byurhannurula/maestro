import "server-only";
import { copyFile, mkdir, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "@/lib/env";
import { sortEntries } from "@/lib/storage/folder-shape";
import { safeRelPath } from "@/lib/storage/paths";
import type { FolderEntry, FolderListing } from "@/lib/types";
import type { Dirent } from "node:fs";

const INVALID_PATH_ERR = "invalid path";

/**
 * Music Folder Browser filesystem layer (PRD §6.6). Reads + organises against
 * the real `./music` volume, and restores/permanently-deletes from `./trash`.
 *
 * Delete = move to `./trash` (same safe flow as §6.4 — never a hard delete in
 * v1 for indexed content), then a purge-rescan is triggered by the route
 * handler. `./trash` items can be restored to their original path or
 * permanently removed.
 *
 * Path traversal is guarded by `safeRelPath` (unit-tested). Every entry's
 * `rel` is library-relative with forward slashes, validated against MUSIC_DIR
 * or TRASH_DIR before any fs op.
 */

/** Resolve a library-relative path under MUSIC_DIR, rejecting any escape. */
const safeSource = (rel: string) => safeRelPath(rel, env.MUSIC_DIR);
/** Resolve a trash-relative path under TRASH_DIR, rejecting any escape. */
const safeTrash = (rel: string) => safeRelPath(rel, env.TRASH_DIR);

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Avoid clobbering an existing file/dir of the same name. */
async function uniqueDest(dest: string): Promise<string> {
  if (!(await exists(dest))) return dest;
  return `${dest}.${Date.now()}`;
}

/** Convert forward-slash rels to the platform separator for fs paths. */
const toFs = (rel: string) => rel.split("/").join(join("a", "b").slice(1, 2));

/**
 * List a directory under MUSIC_DIR. `rel` = "" lists the root.
 * `dirsOnly` filters to directories (used by the tree pane).
 */
export async function listFolder(rel = "", dirsOnly = false): Promise<FolderListing> {
  const abs = safeSource(rel);
  if (!abs) {
    return { path: rel, parent: null, entries: [] };
  }
  return listAbs(abs, rel, dirsOnly);
}

/**
 * List a directory under TRASH_DIR. Same shape as `listFolder` but rooted at
 * the trash volume. The "indexed by Navidrome?" flag is always false here.
 */
export async function listTrash(rel = "", dirsOnly = false): Promise<FolderListing> {
  const abs = safeTrash(rel);
  if (!abs) {
    return { path: rel, parent: null, entries: [] };
  }
  return listAbs(abs, rel, dirsOnly);
}

async function listAbs(abs: string, rel: string, dirsOnly: boolean): Promise<FolderListing> {
  let entries: Dirent[];
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return { path: rel, parent: parentOf(rel), entries: [] };
  }

  const out: FolderEntry[] = [];
  for (const e of entries) {
    if (dirsOnly && !e.isDirectory()) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    try {
      const st = await stat(join(abs, e.name));
      out.push({
        name: e.name,
        rel: childRel,
        isDir: e.isDirectory(),
        sizeBytes: e.isFile() ? st.size : undefined,
        modifiedAt: st.mtime?.toISOString(),
      });
    } catch {
      // Vanished between readdir and stat — still surface the name with no metadata.
      out.push({ name: e.name, rel: childRel, isDir: e.isDirectory() });
    }
  }

  return { path: rel, parent: parentOf(rel), entries: sortEntries(out) };
}

/** Parent rel of a given rel, or null at root. */
function parentOf(rel: string): string | null {
  if (!rel) return null;
  const idx = rel.lastIndexOf("/");
  if (idx === -1) return "";
  return rel.slice(0, idx);
}

export interface FolderMoveResult {
  path: string;
  ok: boolean;
  error?: string;
}

/**
 * Move a file OR directory (recursively) from MUSIC_DIR into TRASH_DIR,
 * preserving the relative path. The directory move is whole-folder: a single
 * `rename`, with an EXDEV fallback that recursively copies then unlinks.
 */
export async function moveToTrash(rels: string[]): Promise<FolderMoveResult[]> {
  return Promise.all(rels.map((rel) => moveBetween(rel, env.MUSIC_DIR, env.TRASH_DIR, "trash")));
}

/**
 * Restore a file OR directory from TRASH_DIR back to its original path under
 * MUSIC_DIR. Same relative path, with a unique-dest collision guard.
 */
export async function restoreFromTrash(rels: string[]): Promise<FolderMoveResult[]> {
  return Promise.all(rels.map((rel) => moveBetween(rel, env.TRASH_DIR, env.MUSIC_DIR, "restore")));
}

/**
 * Permanently delete files/directories from TRASH_DIR. Only ever removes
 * children of TRASH_DIR. Returns what was freed.
 */
export async function permanentlyDelete(rels: string[]): Promise<FolderMoveResult[]> {
  return Promise.all(
    rels.map(async (rel): Promise<FolderMoveResult> => {
      const abs = safeTrash(rel);
      if (!abs) return { path: rel, ok: false, error: INVALID_PATH_ERR };
      if (!(await exists(abs))) return { path: rel, ok: false, error: "not found in trash" };
      try {
        await rm(abs, { recursive: true, force: true });
        return { path: rel, ok: true };
      } catch (e) {
        return { path: rel, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

/**
 * Move a file or folder from one location under MUSIC_DIR to another (the
 * drag-and-drop "organise" primitive). `srcRel` is the source relative path,
 * `destDirRel` is the destination folder's relative path ("" = root).
 */
export async function moveWithinMusic(
  srcRel: string,
  destDirRel: string,
): Promise<FolderMoveResult> {
  const srcAbs = safeSource(srcRel);
  const destDirAbs = safeSource(destDirRel);
  if (!srcAbs) return { path: srcRel, ok: false, error: "invalid source path" };
  if (!destDirAbs) return { path: srcRel, ok: false, error: "invalid destination path" };
  if (!(await exists(srcAbs))) return { path: srcRel, ok: false, error: "source not found" };

  // Reject moving a folder into itself or a descendant.
  if (srcRel === destDirRel || destDirRel.startsWith(`${srcRel}/`)) {
    return { path: srcRel, ok: false, error: "cannot move a folder into itself" };
  }

  const baseName = srcRel.split("/").pop() ?? "";
  const destAbs = await uniqueDest(join(destDirAbs, toFs(baseName)));
  try {
    await mkdir(dirname(destAbs), { recursive: true });
    await moveWithExdevFallback(srcAbs, destAbs);
    return { path: srcRel, ok: true };
  } catch (e) {
    return { path: srcRel, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Create a new folder under MUSIC_DIR. `parentRel` = "" creates at root. */
export async function createFolder(parentRel: string, name: string): Promise<FolderMoveResult> {
  const parentAbs = safeSource(parentRel);
  if (!parentAbs) return { path: parentRel, ok: false, error: "invalid parent path" };
  const cleanName = name.trim().replace(/[\\/]/g, "");
  if (!cleanName) return { path: parentRel, ok: false, error: "invalid folder name" };
  const rel = parentRel ? `${parentRel}/${cleanName}` : cleanName;
  const abs = safeSource(rel);
  if (!abs) return { path: rel, ok: false, error: INVALID_PATH_ERR };
  if (await exists(abs)) return { path: rel, ok: false, error: "folder already exists" };
  try {
    await mkdir(abs, { recursive: true });
    return { path: rel, ok: true };
  } catch (e) {
    return { path: rel, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Rename a file or folder under MUSIC_DIR. Only the final segment changes. */
export async function renamePath(rel: string, newName: string): Promise<FolderMoveResult> {
  const srcAbs = safeSource(rel);
  if (!srcAbs) return { path: rel, ok: false, error: INVALID_PATH_ERR };
  const cleanName = newName.trim().replace(/[\\/]/g, "");
  if (!cleanName) return { path: rel, ok: false, error: "invalid name" };
  if (!(await exists(srcAbs))) return { path: rel, ok: false, error: "not found" };
  const parentRel = parentOf(rel) ?? "";
  const newRel = parentRel ? `${parentRel}/${cleanName}` : cleanName;
  const destAbs = safeSource(newRel);
  if (!destAbs) return { path: rel, ok: false, error: "invalid destination" };
  const dest = await uniqueDest(destAbs);
  try {
    await rename(srcAbs, dest);
    return { path: newRel, ok: true };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EXDEV") {
      await moveWithExdevFallback(srcAbs, dest);
      return { path: newRel, ok: true };
    }
    return { path: rel, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Shared move-with-EXDEV-fallback used by moveToTrash / restore / moveWithinMusic. */
async function moveWithExdevFallback(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EXDEV") {
      await copyRecursive(src, dest);
      await rm(src, { recursive: true, force: true });
    } else {
      throw e;
    }
  }
}

/** Move a single rel between MUSIC_DIR and TRASH_DIR (or vice versa). */
async function moveBetween(
  rel: string,
  fromDir: string,
  toDir: string,
  label: string,
): Promise<FolderMoveResult> {
  const safeFn = fromDir === env.MUSIC_DIR ? safeSource : safeTrash;
  const srcAbs = safeFn(rel);
  if (!srcAbs) return { path: rel, ok: false, error: INVALID_PATH_ERR };
  if (!(await exists(srcAbs))) {
    return { path: rel, ok: false, error: `not found (${label})` };
  }
  const destAbs = await uniqueDest(join(toDir, toFs(rel)));
  try {
    await mkdir(dirname(destAbs), { recursive: true });
    await moveWithExdevFallback(srcAbs, destAbs);
    return { path: rel, ok: true };
  } catch (e) {
    return { path: rel, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Recursive copy for the EXDEV (cross-device) fallback. */
async function copyRecursive(src: string, dest: string): Promise<void> {
  const st = await stat(src);
  if (st.isFile()) {
    await copyFile(src, dest);
    return;
  }
  if (st.isDirectory()) {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const e of entries) {
      await copyRecursive(join(src, e.name), join(dest, e.name));
    }
    return;
  }
  // Symlinks / special files: unlink the dest rather than copying.
  await unlink(dest).catch(() => undefined);
}
