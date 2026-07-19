import { NextResponse } from "next/server";
import { addSongsToPlaylist } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

export const POST = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const body = await readJson<{ playlistId: unknown; songIds: unknown }>(req);
  const playlistId = typeof body.playlistId === "string" ? body.playlistId : "";
  const songIds = Array.isArray(body.songIds)
    ? body.songIds.filter((x): x is string => typeof x === "string")
    : [];
  if (!playlistId) return jsonError("playlistId required");
  if (songIds.length === 0) return jsonError("songIds required");

  await addSongsToPlaylist(playlistId, songIds);
  bust("playlists");
  return NextResponse.json({ ok: true, count: songIds.length });
});
