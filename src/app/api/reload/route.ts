import { NextResponse } from "next/server";
import { withSession } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

/**
 * Drop the in-memory read cache so the next render refetches from Navidrome.
 * Pair with a client `router.refresh()` to actually re-pull the library.
 */
export const POST = withSession(() => {
  bust("songs", "playlists", "discovery");
  return NextResponse.json({ ok: true });
});
