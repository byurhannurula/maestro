import "server-only";
import { access, copyFile, mkdir, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { env } from "@/lib/env";
import { safeRelPath } from "@/lib/storage/paths";
import type { Dirent } from "node:fs";

/**
 * Delete = move a track's file out of the Navidrome-scanned tree into ./trash,
 * preserving its relative path. Never a hard delete. A follow-up purge-rescan
 * clears the now-missing rows from Navidrome.
 */

export interface MoveResult {
  path: string;
  ok: boolean;
  error?: string;
}

/** Resolve a library-relative path under MUSIC_DIR, rejecting any escape. */
const safeSource = (rel: string) => safeRelPath(rel, env.MUSIC_DIR);

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Avoid clobbering an already-trashed file of the same name. */
async function uniqueDest(dest: string): Promise<string> {
  if (!(await exists(dest))) return dest;
  const ext = extname(dest);
  const base = ext ? dest.slice(0, -ext.length) : dest;
  return `${base}.${Date.now()}${ext}`;
}

async function moveOneFile(rel: string): Promise<MoveResult> {
  const src = safeSource(rel);
  if (!src) return { path: rel, ok: false, error: "invalid path" };
  if (!(await exists(src))) {
    return { path: rel, ok: false, error: "file not found under MUSIC_DIR" };
  }
  try {
    const destRel = relative(env.MUSIC_DIR, src);
    const dest = await uniqueDest(join(env.TRASH_DIR, destRel));
    await mkdir(dirname(dest), { recursive: true });
    try {
      await rename(src, dest);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EXDEV") {
        await copyFile(src, dest);
        await unlink(src);
      } else {
        throw e;
      }
    }
    return { path: rel, ok: true };
  } catch (e) {
    return { path: rel, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function moveToTrash(relPaths: string[]): Promise<MoveResult[]> {
  return Promise.all(relPaths.map(moveOneFile));
}

export interface TrashInfo {
  /** Total size of all files under TRASH_DIR, in bytes. */
  bytes: number;
  /** Number of files (not directories) under TRASH_DIR. */
  files: number;
}

/** Recursively sum file sizes/counts under a directory (missing dir → zeros). */
async function walk(dir: string): Promise<TrashInfo> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes: 0, files: 0 };
  }
  let bytes = 0;
  let files = 0;
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      const sub = await walk(p);
      bytes += sub.bytes;
      files += sub.files;
    } else if (e.isFile()) {
      try {
        bytes += (await stat(p)).size;
        files += 1;
      } catch {
        /* vanished between readdir and stat — ignore */
      }
    }
  }
  return { bytes, files };
}

/** Current size + file count of ./trash. */
export function getTrashInfo(): Promise<TrashInfo> {
  return walk(env.TRASH_DIR);
}

/**
 * Permanently delete everything inside ./trash (the directory itself is kept).
 * Only ever removes children of TRASH_DIR. Returns what was freed.
 */
export async function emptyTrash(): Promise<TrashInfo> {
  const freed = await walk(env.TRASH_DIR);
  let entries: Dirent[];
  try {
    entries = await readdir(env.TRASH_DIR, { withFileTypes: true });
  } catch {
    return { bytes: 0, files: 0 };
  }
  for (const e of entries) {
    await rm(join(env.TRASH_DIR, e.name), { recursive: true, force: true });
  }
  return freed;
}
