import { isNavidromeConfigured } from "@/lib/env";
import { streamUrl } from "@/lib/navidrome/subsonic";
import { withSession } from "@/lib/route";

const CT = "content-type";
const AR = "accept-ranges";
const HEADER_COPY = [CT, "content-length", "content-range", AR] as const;

export const dynamic = "force-dynamic";

/**
 * Proxies Navidrome audio so the browser never sees Subsonic credentials —
 * same shape as /api/cover, but forwards the Range header and passes back
 * 206 Partial Content so the <audio> element can seek (and so Safari/iOS,
 * which require range requests, will play at all).
 *
 * GET /api/stream?id=<songId>
 */
export const GET = withSession(async (req) => {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !isNavidromeConfigured) {
    return new Response(null, { status: 404 });
  }

  const range = req.headers.get("range");
  try {
    const upstream = await fetch(streamUrl(id), {
      cache: "no-store",
      headers: range ? { range } : {},
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(null, { status: upstream.status || 502 });
    }

    const headers = new Headers();
    for (const h of HEADER_COPY) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has(AR)) headers.set(AR, "bytes");
    if (!headers.has(CT)) headers.set(CT, "audio/mpeg");
    headers.set("cache-control", "no-store");

    // Preserve upstream status (206 for a ranged request, 200 otherwise).
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(null, { status: 502 });
  }
});
