import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { setStarred } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";
import { bust } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; starred?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

  await setStarred(ids, Boolean(body.starred));
  bust("songs");
  return NextResponse.json({ ok: true, count: ids.length });
}
