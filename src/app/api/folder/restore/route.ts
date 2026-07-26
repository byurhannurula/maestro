import { NextResponse } from "next/server";
import { isNavidromeConfigured } from "@/lib/env";
import { startScan } from "@/lib/navidrome/subsonic";
import { withSession, readJson, jsonError, requireNavidrome } from "@/lib/route";
import { bust } from "@/lib/storage/cache";
import { restoreFromTrash } from "@/lib/storage/folder";

export const dynamic = "force-dynamic";

/**
 * Restore files/folders from ./trash back to their original path under MUSIC_DIR
 * (PRD §6.6 + the deferred §9 restore view). Body: `{ paths: string[] }` — the
 * trash-relative paths. Triggers a rescan so Navidrome picks up the restored
 * files.
 */
export const POST = withSession(async (req) => {
  const gate = requireNavidrome();
  if (gate) return gate;

  const body = await readJson<{ paths: unknown }>(req);
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (paths.length === 0) return jsonError("paths required");

  const results = await restoreFromTrash(paths);
  const restored = results.filter((r) => r.ok).length;

  if (restored > 0) bust("songs", "playlists");
  if (restored > 0 && isNavidromeConfigured) {
    await startScan().catch(() => undefined);
  }

  return NextResponse.json({ restored, failed: results.length - restored, results });
});
