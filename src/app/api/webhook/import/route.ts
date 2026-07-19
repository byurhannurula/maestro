import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env, isNavidromeConfigured } from "@/lib/env";
import { parseImportList } from "@/lib/import/parse";
import { createBatch } from "@/lib/import/store";
import { runBatch } from "@/lib/import/worker";
import { getPlaylists } from "@/lib/navidrome/subsonic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Machine-to-machine ingest into the import pipeline (§6.7). Canonical use:
 * Shazam → iOS Shortcut → POST { artist, title } → the track downloads and
 * lands in the configured playlist (default "Shazam").
 *
 * Auth is a shared secret (NOT a session) — `proxy.ts` excludes `/api/webhook/*`
 * from the cookie gate, so this handler enforces `WEBHOOK_SECRET` itself.
 * Disabled entirely until `WEBHOOK_SECRET` is set.
 *
 * Accepts JSON, form-encoded, or a bare text body. Recognised fields:
 *   { artist, title } | { line } | { query } | { text }  (+ optional { playlist })
 */

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Pull the caller's secret from Authorization: Bearer, header, or ?secret=. */
function providedSecret(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
}

/** Constant-time secret comparison; false when unconfigured or mismatched. */
function secretOk(provided: string): boolean {
  const expected = env.WEBHOOK_SECRET;
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Read a flexible body (JSON / form / raw text) into a flat string map. */
async function readBody(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null);
    return j && typeof j === "object" ? (j as Record<string, string>) : {};
  }
  if (ct.includes("form")) {
    const f = await req.formData().catch(() => null);
    if (!f) return {};
    const o: Record<string, string> = {};
    for (const [k, v] of f.entries()) if (typeof v === "string") o[k] = v;
    return o;
  }
  const t = await req.text().catch(() => "");
  return t ? { line: t } : {};
}

/**
 * Resolve the target playlist by name to an existing id so repeated webhooks
 * append to the same playlist instead of the worker creating a new one each
 * time. Falls back to create-by-name when it doesn't exist yet.
 */
async function resolveTarget(
  name: string,
): Promise<{ playlistId?: string; playlistName?: string }> {
  try {
    const playlists = await getPlaylists();
    const match = playlists.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (match) return { playlistId: match.id };
  } catch {
    /* fall through to create-by-name */
  }
  return { playlistName: name };
}

export async function POST(req: NextRequest) {
  if (!env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook disabled (set WEBHOOK_SECRET)" }, { status: 503 });
  }
  if (!secretOk(providedSecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }

  const body = await readBody(req);
  const playlistName = (str(body.playlist).trim() || env.WEBHOOK_PLAYLIST).trim();

  let raw = str(body.line) || str(body.query) || str(body.text);
  if (!raw) {
    const artist = str(body.artist).trim();
    const title = str(body.title).trim();
    raw = artist && title ? `${artist} - ${title}` : title || artist;
  }
  raw = raw.trim();
  if (!raw) {
    return NextResponse.json(
      { error: "no importable input (send { artist, title } or { line })" },
      { status: 400 },
    );
  }

  const parsed = parseImportList(raw);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "no importable lines" }, { status: 400 });
  }

  const target = playlistName ? await resolveTarget(playlistName) : {};
  const batch = createBatch(
    parsed.map((p) => ({
      line: p.raw,
      artist: p.primaryArtist,
      title: p.title,
      searchQuery: p.searchQuery,
    })),
    target,
  );

  // Fire-and-forget: the worker runs in this long-lived process; progress shows
  // up in the Import page history like any UI-started batch.
  void runBatch(batch);

  return NextResponse.json(
    {
      batchId: batch.id,
      accepted: parsed.length,
      playlist: playlistName || null,
      tracks: parsed.map((p) => ({ artist: p.primaryArtist ?? null, title: p.title ?? p.raw })),
    },
    { status: 202 },
  );
}
