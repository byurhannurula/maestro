import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { addSongsToPlaylist } from "@/lib/navidrome/subsonic";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    playlistId?: unknown;
    songIds?: unknown;
  };
  const playlistId = typeof body.playlistId === "string" ? body.playlistId : "";
  const songIds = Array.isArray(body.songIds)
    ? body.songIds.filter((x): x is string => typeof x === "string")
    : [];
  if (!playlistId) return NextResponse.json({ error: "playlistId required" }, { status: 400 });
  if (songIds.length === 0)
    return NextResponse.json({ error: "songIds required" }, { status: 400 });

  await addSongsToPlaylist(playlistId, songIds);
  bust("playlists");
  return NextResponse.json({ ok: true, count: songIds.length });
}
