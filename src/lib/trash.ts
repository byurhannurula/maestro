import "server-only";
import { access, copyFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { env } from "./env";

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
function safeSource(rel: string): string | null {
  let r = rel;
  if (isAbsolute(r)) {
    const asRel = relative(env.MUSIC_DIR, r);
    if (asRel.startsWith("..") || isAbsolute(asRel)) return null;
    r = asRel;
  }
  const abs = resolve(env.MUSIC_DIR, r);
  const back = relative(env.MUSIC_DIR, abs);
  if (back.startsWith("..") || isAbsolute(back)) return null;
  return abs;
}

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

export async function moveToTrash(relPaths: string[]): Promise<MoveResult[]> {
  const results: MoveResult[] = [];
  for (const rel of relPaths) {
    const src = safeSource(rel);
    if (!src) {
      results.push({ path: rel, ok: false, error: "invalid path" });
      continue;
    }
    try {
      const destRel = relative(env.MUSIC_DIR, src);
      const dest = await uniqueDest(join(env.TRASH_DIR, destRel));
      await mkdir(dirname(dest), { recursive: true });
      try {
        await rename(src, dest);
      } catch (e) {
        // /music and /trash may be different mounts → rename fails cross-device.
        if ((e as NodeJS.ErrnoException).code === "EXDEV") {
          await copyFile(src, dest);
          await unlink(src);
        } else {
          throw e;
        }
      }
      results.push({ path: rel, ok: true });
    } catch (e) {
      results.push({ path: rel, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
