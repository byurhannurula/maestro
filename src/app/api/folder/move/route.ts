import { NextResponse } from "next/server";
import { isNavidromeConfigured } from "@/lib/env";
import { startScan } from "@/lib/navidrome/subsonic";
import { withSession, readJson, jsonError, requireNavidrome } from "@/lib/route";
import { bust } from "@/lib/storage/cache";
import { moveWithinMusic } from "@/lib/storage/folder";

export const dynamic = "force-dynamic";

/**
 * Move a file/folder to a different folder within MUSIC_DIR (drag-and-drop
 * organise, PRD §6.6). Body: `{ src: string, destDir: string }` where destDir
 * is the destination folder's library-relative path ("" = root). Triggers a
 * rescan so Navidrome re-indexes the moved file at its new path.
 */
export const POST = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ src: unknown; destDir: unknown }>(req);
  const src = typeof body.src === "string" ? body.src : "";
  const destDir = typeof body.destDir === "string" ? body.destDir : "";

  if (!src) return jsonError("src required");

  const result = await moveWithinMusic(src, destDir);
  if (!result.ok) return jsonError(result.error ?? "move failed", 400);

  bust("songs", "playlists");
  if (isNavidromeConfigured) {
    await startScan().catch(() => undefined);
  }
  return NextResponse.json(result);
});
