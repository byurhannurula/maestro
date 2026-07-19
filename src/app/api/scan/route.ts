import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { startScan, getScanStatus } from "@/lib/navidrome/subsonic";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

/** Trigger a Navidrome scan and return the (async) scan status. */
export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }

  await startScan();
  bust("songs", "playlists");
  const status = await getScanStatus().catch(() => ({ scanning: false, count: 0 }));
  return NextResponse.json({ ok: true, ...status });
}
