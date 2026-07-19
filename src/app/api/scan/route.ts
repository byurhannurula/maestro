import { NextResponse } from "next/server";
import { startScan, getScanStatus } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

/** Trigger a Navidrome scan and return the (async) scan status. */
export const POST = withSession(async () => {
  const bad = requireNavidrome();
  if (bad) return bad;

  await startScan();
  bust("songs", "playlists");
  const status = await getScanStatus().catch(() => ({ scanning: false, count: 0 }));
  return NextResponse.json({ ok: true, ...status });
});
