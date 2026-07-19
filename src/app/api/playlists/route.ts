import { NextResponse } from "next/server";
import { getLibraryPlaylists } from "@/lib/navidrome/library";
import { createPlaylist, deletePlaylist } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

export const GET = withSession(async () => {
  return NextResponse.json(await getLibraryPlaylists());
});

export const POST = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const body = await readJson<{ name: unknown }>(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("name required");

  await createPlaylist(name);
  bust("playlists");
  return NextResponse.json(await getLibraryPlaylists());
});

export const DELETE = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return jsonError("id required");

  await deletePlaylist(id);
  bust("playlists");
  return NextResponse.json(await getLibraryPlaylists());
});
