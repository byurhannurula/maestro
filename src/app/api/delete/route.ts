import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { moveToTrash } from "@/lib/trash";
import { startScan } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * Move the given library-relative file paths to ./trash, then trigger a
 * Navidrome rescan so the now-missing rows are purged.
 */
export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { paths?: unknown };
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "paths required" }, { status: 400 });
  }

  const results = await moveToTrash(paths);
  const moved = results.filter((r) => r.ok).length;
  if (moved > 0) bust("songs", "playlists");

  // Purge-rescan so Navidrome drops the missing tracks.
  if (moved > 0 && isNavidromeConfigured) {
    await startScan().catch(() => {
      /* files already moved; scan can be retried from System */
    });
  }

  return NextResponse.json({ moved, failed: results.length - moved, results });
}
