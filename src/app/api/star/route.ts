import { NextResponse } from "next/server";
import { setStarred } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

export const POST = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const body = await readJson<{ ids: unknown; starred: unknown }>(req);
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string")
    : [];
  if (ids.length === 0) return jsonError("ids required");

  await setStarred(ids, Boolean(body.starred));
  bust("songs");
  return NextResponse.json({ ok: true, count: ids.length });
});
