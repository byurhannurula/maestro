import { NextResponse } from "next/server";
import { isNavidromeConfigured } from "@/lib/env";
import { markIndexed } from "@/lib/navidrome/indexed-paths";
import { getIndexedPaths } from "@/lib/navidrome/library";
import { startScan } from "@/lib/navidrome/subsonic";
import { withSession, readJson, jsonError, requireNavidrome } from "@/lib/route";
import { bust } from "@/lib/storage/cache";
import {
  createFolder,
  listFolder,
  listTrash,
  moveToTrash,
  permanentlyDelete,
  renamePath,
} from "@/lib/storage/folder";
import type { FolderListing } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Music Folder Browser (PRD §6.6).
 *
 * `GET ?path=<rel>&root=music|trash&dirsOnly=1` — list a directory under
 * MUSIC_DIR (default) or TRASH_DIR. When root=music, files are annotated with
 * the "indexed by Navidrome?" flag. dirsOnly filters to directories (tree pane).
 *
 * `POST  { paths }` — move files/folders to ./trash, then purge-rescan.
 * `PUT   { parent, name }` — create a new folder under MUSIC_DIR.
 * `PATCH { rel, newName }` — rename a file/folder under MUSIC_DIR.
 * `DELETE { paths }` — permanently delete from TRASH_DIR (irreversible).
 */
export const GET = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const sp = req.nextUrl.searchParams;
  const path = sp.get("path") ?? "";
  if (path.includes("\0")) return jsonError("invalid path");
  const root = sp.get("root") === "trash" ? "trash" : "music";
  const dirsOnly = sp.get("dirsOnly") === "1";

  const listing: FolderListing =
    root === "trash" ? await listTrash(path, dirsOnly) : await listFolder(path, dirsOnly);

  // Annotate music-root files with the "indexed by Navidrome?" flag.
  if (root === "music" && !dirsOnly) {
    const index = await getIndexedPaths();
    listing.entries = markIndexed(listing.entries, index);
  }

  return NextResponse.json(listing);
});

export const POST = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ paths: unknown }>(req);
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (paths.length === 0) return jsonError("paths required");

  const results = await moveToTrash(paths);
  const moved = results.filter((r) => r.ok).length;

  if (moved > 0) bust("songs", "playlists");
  if (moved > 0 && isNavidromeConfigured) {
    await startScan().catch(() => {
      /* files already moved; scan can be retried from System */
    });
  }

  return NextResponse.json({ moved, failed: results.length - moved, results });
});

export const PUT = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ parent: unknown; name: unknown }>(req);
  const parent = typeof body.parent === "string" ? body.parent : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!name.trim()) return jsonError("name required");

  const result = await createFolder(parent, name);
  if (!result.ok) return jsonError(result.error ?? "create failed", 400);
  return NextResponse.json(result);
});

export const PATCH = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ rel: unknown; newName: unknown }>(req);
  const rel = typeof body.rel === "string" ? body.rel : "";
  const newName = typeof body.newName === "string" ? body.newName : "";

  if (!rel) return jsonError("rel required");
  if (!newName.trim()) return jsonError("newName required");

  const result = await renamePath(rel, newName);
  if (!result.ok) return jsonError(result.error ?? "rename failed", 400);
  // A rename changes the file's physical path → Navidrome sees a new path on
  // rescan, so bust + rescan to keep the index in sync.
  bust("songs", "playlists");
  if (isNavidromeConfigured) {
    await startScan().catch(() => undefined);
  }
  return NextResponse.json(result);
});

export const DELETE = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ paths: unknown }>(req);
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (paths.length === 0) return jsonError("paths required");

  const results = await permanentlyDelete(paths);
  const deleted = results.filter((r) => r.ok).length;
  return NextResponse.json({ deleted, failed: results.length - deleted, results });
});
