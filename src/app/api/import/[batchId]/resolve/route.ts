import { NextResponse, type NextRequest } from "next/server";
import { getBatch, save } from "@/lib/import-store";
import { addSongsToPlaylist } from "@/lib/subsonic";
import { isNavidromeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Resolve a needs_review job:
 *  - action "pick": add the chosen candidate songId to the batch playlist → added
 *  - action "skip": mark the job skipped
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ batchId: string }> },
) {
  if (!isNavidromeConfigured) {
    return NextResponse.json({ error: "Navidrome not configured" }, { status: 400 });
  }
  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "batch not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    jobId?: unknown;
    action?: unknown;
    songId?: unknown;
  };
  const job = batch.jobs.find((j) => j.id === body.jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  if (body.action === "skip") {
    job.status = "skipped";
    save();
    return NextResponse.json(batch);
  }

  if (body.action === "pick") {
    const songId = typeof body.songId === "string" ? body.songId : "";
    if (!songId) return NextResponse.json({ error: "songId required" }, { status: 400 });
    try {
      if (batch.playlistId) await addSongsToPlaylist(batch.playlistId, [songId]);
      job.matchedSongId = songId;
      job.status = "added";
      job.error = undefined;
      save();
      return NextResponse.json(batch);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
