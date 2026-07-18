import { type NextRequest } from "next/server";
import { isNavidromeConfigured } from "@/lib/env";
import { coverArtUrl } from "@/lib/subsonic";

export const dynamic = "force-dynamic";

/**
 * Proxies Navidrome cover art so the browser never sees Subsonic credentials.
 * GET /api/cover?id=<coverArtId>&size=80
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const size = Number(req.nextUrl.searchParams.get("size")) || 80;
  if (!id || !isNavidromeConfigured) {
    return new Response(null, { status: 404 });
  }

  try {
    const upstream = await fetch(coverArtUrl(id, size), { cache: "no-store" });
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 404 });
    return new Response(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
