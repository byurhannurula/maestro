import { NextResponse } from "next/server";
import { parseImportList } from "@/lib/import/parse";
import { createBatch, listBatches, clearFinishedBatches } from "@/lib/import/store";
import { runBatch } from "@/lib/import/worker";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";

export const dynamic = "force-dynamic";

export const GET = withSession(() => {
  return NextResponse.json({ batches: listBatches() });
});

/** Clear finished batches from history (running ones are kept). */
export const DELETE = withSession(() => {
  const removed = clearFinishedBatches();
  return NextResponse.json({ removed, batches: listBatches() });
});

export const POST = withSession(async (req) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const body = await readJson<{ text: unknown; playlistId: unknown; playlistName: unknown }>(req);
  const text = typeof body.text === "string" ? body.text : "";
  const playlistId =
    typeof body.playlistId === "string" && body.playlistId ? body.playlistId : undefined;
  const playlistName =
    typeof body.playlistName === "string" && body.playlistName.trim()
      ? body.playlistName.trim()
      : undefined;

  const parsed = parseImportList(text);
  if (parsed.length === 0) return jsonError("no importable lines");

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
});
