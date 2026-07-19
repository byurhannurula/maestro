import { NextResponse } from "next/server";
import { removeFromPlaylist } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

export const POST = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const body = await readJson<{ playlistId: unknown; indices: unknown }>(req);
  const playlistId = typeof body.playlistId === "string" ? body.playlistId : "";
  const indices = Array.isArray(body.indices)
    ? body.indices.filter((n): n is number => typeof n === "number" && Number.isInteger(n))
    : [];
  if (!playlistId) return jsonError("playlistId required");
  if (indices.length === 0) return jsonError("indices required");

  await removeFromPlaylist(playlistId, indices);
  bust("playlists");
  return NextResponse.json({ ok: true, count: indices.length });
});
