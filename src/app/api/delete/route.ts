import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { moveToTrash, type MoveResult } from "@/lib/storage/trash";
import { startScan } from "@/lib/navidrome/subsonic";
import { getSongPaths } from "@/lib/navidrome/native";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

/**
 * Move tracks to ./trash, then trigger a Navidrome rescan to purge the rows.
 *
 * Accepts song `ids` (preferred) — the real physical path is resolved from the
 * Native API, because the Subsonic path (used by playlist/search views) is
 * tag-derived and does NOT match the file on disk. Legacy `paths` are still
 * accepted for callers that already hold a Native-sourced path.
 */
export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; paths?: unknown };
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  const rawPaths = Array.isArray(body.paths)
    ? body.paths.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (ids.length === 0 && rawPaths.length === 0) {
    return NextResponse.json({ error: "ids or paths required" }, { status: 400 });
  }

  // Resolve ids → real physical paths; keep the id alongside for the response.
  const resolved = ids.length ? await getSongPaths(ids) : [];
  const unresolved = resolved.filter((r) => !r.path).map((r) => r.id);
  const pairs: Array<{ id?: string; path: string }> = [
    ...resolved.filter((r): r is { id: string; path: string } => !!r.path),
    ...rawPaths.map((path) => ({ path })),
  ];

  const moveResults = await moveToTrash(pairs.map((p) => p.path));
  const results: Array<MoveResult & { id?: string }> = pairs.map((p, i) => ({
    id: p.id,
    ...moveResults[i],
  }));
  // Ids Navidrome couldn't resolve to a path (stale/phantom rows) → report honestly.
  for (const id of unresolved) {
    results.push({ id, path: id, ok: false, error: "could not resolve file path" });
  }

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
