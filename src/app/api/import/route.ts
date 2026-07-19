import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { parseImportList } from "@/lib/import/parse";
import { createBatch, listBatches } from "@/lib/import/store";
import { runBatch } from "@/lib/import/worker";
import { isNavidromeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSession(await headers());
  if (gate.response) return gate.response;

  return NextResponse.json({ batches: listBatches() });
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    text?: unknown;
    playlistId?: unknown;
    playlistName?: unknown;
  };
  const text = typeof body.text === "string" ? body.text : "";
  const playlistId =
    typeof body.playlistId === "string" && body.playlistId ? body.playlistId : undefined;
  const playlistName =
    typeof body.playlistName === "string" && body.playlistName.trim()
      ? body.playlistName.trim()
      : undefined;

  const parsed = parseImportList(text);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "no importable lines" }, { status: 400 });
  }

  const batch = createBatch(
    parsed.map((p) => ({
      line: p.raw,
      artist: p.primaryArtist,
      title: p.title,
      searchQuery: p.searchQuery,
    })),
    { playlistId, playlistName },
  );

  // Fire-and-forget: the worker runs in this long-lived server process while
  // the client polls GET /api/import/[batchId].
  void runBatch(batch);

  return NextResponse.json({ batchId: batch.id, jobs: batch.jobs });
}
