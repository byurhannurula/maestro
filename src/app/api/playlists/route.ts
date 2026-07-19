import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getLibraryPlaylists } from "@/lib/library";
import { createPlaylist, deletePlaylist } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSession(await headers());
  if (gate.response) return gate.response;

  return NextResponse.json(await getLibraryPlaylists());
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  await createPlaylist(name);
  bust("playlists");
  return NextResponse.json(await getLibraryPlaylists());
}

export async function DELETE(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await deletePlaylist(id);
  bust("playlists");
  return NextResponse.json(await getLibraryPlaylists());
}
