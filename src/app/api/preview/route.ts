import { NextResponse } from "next/server";
import { withSession, jsonError } from "@/lib/route";

export const dynamic = "force-dynamic";

// Deezer preview clips live on *.dzcdn.net. Streaming them straight into an
// <audio> element is blocked cross-origin (CORB), so we proxy them same-origin.
// Host-allowlisted to avoid turning this into an open proxy.
const ALLOWED_HOST = /(^|\.)dzcdn\.net$/i;

export const GET = withSession(async (req) => {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return jsonError("url required");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return jsonError("bad url");
  }
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) {
    return jsonError("host not allowed");
  }

  // Forward Range so the browser can seek within the clip.
  const range = req.headers.get("range");
  const upstream = await fetch(target, { headers: range ? { range } : {} });
  if (!upstream.ok || !upstream.body) {
    return jsonError(`upstream ${upstream.status}`, 502);
  }

  const headers = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "audio/mpeg",
  });
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "public, max-age=86400");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
});
