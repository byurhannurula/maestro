import { NextResponse } from "next/server";
import { getBatch, save } from "@/lib/import/store";
import { addSongsToPlaylist } from "@/lib/navidrome/subsonic";
import { withSession, requireNavidrome, readJson, jsonError } from "@/lib/route";
import { bust } from "@/lib/storage/cache";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string }> };

/**
 * Resolve a needs_review job:
 *  - action "pick": add the chosen candidate songId to the batch playlist → added
 *  - action "skip": mark the job skipped
 */
export const POST = withSession<Ctx>(async (req, ctx) => {
  const bad = requireNavidrome();
  if (bad) return bad;

  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return jsonError("batch not found", 404);

  const body = await readJson<{ jobId: unknown; action: unknown; songId: unknown }>(req);
  const job = batch.jobs.find((j) => j.id === body.jobId);
  if (!job) return jsonError("job not found", 404);

  if (body.action === "skip") {
    job.status = "skipped";
    save();
    return NextResponse.json(batch);
  }

  if (body.action === "pick") {
    const songId = typeof body.songId === "string" ? body.songId : "";
    if (!songId) return jsonError("songId required");
    if (batch.playlistId) await addSongsToPlaylist(batch.playlistId, [songId]);
    job.matchedSongId = songId;
    job.status = "added";
    job.error = undefined;
    save();
    bust("playlists");
    return NextResponse.json(batch);
  }

  return jsonError("unknown action");
});
