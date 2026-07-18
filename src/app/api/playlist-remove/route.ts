import { NextResponse, type NextRequest } from "next/server";
import { removeFromPlaylist } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    playlistId?: unknown;
    indices?: unknown;
  };
  const playlistId = typeof body.playlistId === "string" ? body.playlistId : "";
  const indices = Array.isArray(body.indices)
    ? body.indices.filter((n): n is number => typeof n === "number" && Number.isInteger(n))
    : [];
  if (!playlistId) return NextResponse.json({ error: "playlistId required" }, { status: 400 });
  if (indices.length === 0) return NextResponse.json({ error: "indices required" }, { status: 400 });

  await removeFromPlaylist(playlistId, indices);
  return NextResponse.json({ ok: true, count: indices.length });
}
