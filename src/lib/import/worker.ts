import "server-only";
import { ensureLoggedIn, searchTrack, addToQueue, getQueue } from "@/lib/deemix";
import { env } from "@/lib/env";
import { norm, pickMatch } from "@/lib/import/match";
import { save, type ImportBatch, type ImportJob } from "@/lib/import/store";
import {
  createPlaylist,
  addSongsToPlaylist,
  startScan,
  getScanStatus,
  search3Songs,
} from "@/lib/navidrome/subsonic";
import { bust } from "@/lib/storage/cache";
import type { Song } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll the deemix queue until it drains (our serial download finished) or times out. */
async function waitForQueueDrain(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // Small head start so the item registers before we start polling.
  await sleep(1000);
  while (Date.now() < deadline) {
    const q = await getQueue().catch(() => ({ queueOrder: [] as string[] }));
    if (!q.queueOrder || q.queueOrder.length === 0) return;
    await sleep(2000);
  }
}

async function waitForScan(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  await sleep(1500);
  while (Date.now() < deadline) {
    const s = await getScanStatus().catch(() => ({ scanning: false, count: 0 }));
    if (!s.scanning) return;
    await sleep(2000);
  }
}

/**
 * Run an import batch to completion, mutating job statuses in place (the store
 * holds the same object references, so the polling UI sees live updates).
 */
export async function runBatch(batch: ImportBatch): Promise<void> {
  // Persist live progress to disk every couple of seconds while running.
  const saver = setInterval(save, 2000);
  try {
    // Resolve the target playlist (create by name if needed).
    let playlistId = batch.playlistId;
    if (!playlistId && batch.playlistName) {
      playlistId = await createPlaylist(batch.playlistName);
      batch.playlistId = playlistId;
    }

    const ok = await ensureLoggedIn();
    if (!ok) {
      batch.error = "deemix not logged in (check DEEMIX_ARL / Deezer availability)";
    }

    // 1. Search + queue downloads, one at a time (respect Deezer rate limits).
    for (const job of batch.jobs) {
      if (job.status !== "queued") continue;
      job.status = "searching";
      let tracks;
      try {
        tracks = await searchTrack(job.searchQuery, 3);
      } catch (e) {
        job.status = "download_failed";
        job.error = e instanceof Error ? e.message : String(e);
        continue;
      }
      if (tracks.length === 0) {
        job.status = "not_found";
        continue;
      }
      job.deezer = tracks[0];
      job.status = "downloading";
      try {
        const res = await addToQueue(job.deezer.link);
        if (!res.result) {
          job.status = "download_failed";
          job.error = res.errid ?? "addToQueue rejected";
          continue;
        }
        await waitForQueueDrain(env.IMPORT_TIMEOUT_MS);
      } catch (e) {
        job.status = "download_failed";
        job.error = e instanceof Error ? e.message : String(e);
        continue;
      }
      await sleep(env.IMPORT_DELAY_MS);
    }

    // 2. One Navidrome scan for the whole batch.
    const downloaded = batch.jobs.filter((j) => j.status === "downloading");
    if (downloaded.length > 0) {
      downloaded.forEach((j) => (j.status = "scanning"));
      try {
        await startScan();
        await waitForScan(env.IMPORT_TIMEOUT_MS);
      } catch {
        /* proceed to matching regardless */
      }
    }

    // 3. Match each downloaded track against Navidrome, add to the playlist.
    for (const job of batch.jobs) {
      if (job.status !== "scanning") continue;
      job.status = "matching";
      let candidates: Song[] = [];
      try {
        candidates = await search3Songs(`${job.artist ?? ""} ${job.title ?? ""}`.trim(), 0, 8);
      } catch (e) {
        job.status = "needs_review";
        job.error = e instanceof Error ? e.message : String(e);
        continue;
      }
      const match = pickMatch(job, candidates);
      if (!match) {
        job.status = "needs_review";
        job.candidates = candidates.slice(0, 5);
        continue;
      }
      job.matchedSongId = match.id;
      if (playlistId) {
        try {
          await addSongsToPlaylist(playlistId, [match.id]);
        } catch (e) {
          job.status = "add_failed";
          job.error = e instanceof Error ? e.message : String(e);
          continue;
        }
      }
      job.status = "added";
    }
  } catch (e) {
    batch.error = e instanceof Error ? e.message : String(e);
  } finally {
    batch.done = true;
    clearInterval(saver);
    save();
    // New tracks + playlist membership changed — drop the caches.
    bust("songs", "playlists");
  }
}
