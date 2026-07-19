import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

/**
 * Drop the in-memory read cache so the next render refetches from Navidrome.
 * Pair with a client `router.refresh()` to actually re-pull the library.
 */
export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  bust("songs", "playlists");
  return NextResponse.json({ ok: true });
}
