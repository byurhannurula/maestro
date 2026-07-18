import { NextResponse, type NextRequest } from "next/server";
import { getLibraryPlaylists } from "@/lib/library";
import { createPlaylist, deletePlaylist } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getLibraryPlaylists());
}

export async function POST(req: NextRequest) {
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  await createPlaylist(name);
  return NextResponse.json(await getLibraryPlaylists());
}

export async function DELETE(req: NextRequest) {
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await deletePlaylist(id);
  return NextResponse.json(await getLibraryPlaylists());
}
