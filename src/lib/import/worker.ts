import "server-only";
import { ensureLoggedIn, searchTrack, addToQueue, getQueue } from "@/lib/deemix";
import { env } from "@/lib/env";
import { pickMatch } from "@/lib/import/match";
import { save, type ImportBatch } from "@/lib/import/store";
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

async function waitForQueueDrain(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
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

async function searchJobTrack(job: ImportBatch["jobs"][number]): Promise<boolean> {
  job.status = "searching";
  let tracks;
  try {
    tracks = await searchTrack(job.searchQuery, 3);
  } catch (e) {
    job.status = "download_failed";
    job.error = e instanceof Error ? e.message : String(e);
    return false;
  }
  if (tracks.length === 0) {
    job.status = "not_found";
    return false;
  }
  job.deezer = tracks[0];
  return true;
}

async function downloadJobTrack(job: ImportBatch["jobs"][number]): Promise<boolean> {
  job.status = "downloading";
  try {
    const res = await addToQueue(job.deezer!.link);
    if (!res.result) {
      job.status = "download_failed";
      job.error = res.errid ?? "addToQueue rejected";
      return false;
    }
    await waitForQueueDrain(env.IMPORT_TIMEOUT_MS);
  } catch (e) {
    job.status = "download_failed";
    job.error = e instanceof Error ? e.message : String(e);
    return false;
  }
  await sleep(env.IMPORT_DELAY_MS);
  return true;
}

async function searchAndDownload(batch: ImportBatch): Promise<void> {
  for (const job of batch.jobs) {
    if (job.status !== "queued") continue;
    const found = await searchJobTrack(job);
    if (!found) continue;
    await downloadJobTrack(job);
  }
}

async function scanAfterDownload(batch: ImportBatch): Promise<void> {
  const downloaded = batch.jobs.filter((j) => j.status === "downloading");
  if (downloaded.length === 0) return;
  downloaded.forEach((j) => (j.status = "scanning"));
  try {
    await startScan();
    await waitForScan(env.IMPORT_TIMEOUT_MS);
  } catch {
    /* proceed to matching regardless */
  }
}

async function matchJobTrack(
  job: ImportBatch["jobs"][number],
  playlistId: string | undefined,
): Promise<void> {
  job.status = "matching";
  let candidates: Song[] = [];
  try {
    candidates = await search3Songs(`${job.artist ?? ""} ${job.title ?? ""}`.trim(), 0, 8);
  } catch (e) {
    job.status = "needs_review";
    job.error = e instanceof Error ? e.message : String(e);
    return;
  }
  const match = pickMatch(job, candidates);
  if (!match) {
    job.status = "needs_review";
    job.candidates = candidates.slice(0, 5);
    return;
  }
  job.matchedSongId = match.id;
  if (playlistId) {
    try {
      await addSongsToPlaylist(playlistId, [match.id]);
    } catch (e) {
      job.status = "add_failed";
      job.error = e instanceof Error ? e.message : String(e);
      return;
    }
  }
  job.status = "added";
}

async function matchAndAddToPlaylist(
  batch: ImportBatch,
  playlistId: string | undefined,
): Promise<void> {
  for (const job of batch.jobs) {
    if (job.status !== "scanning") continue;
    await matchJobTrack(job, playlistId);
  }
}

async function resolvePlaylist(batch: ImportBatch): Promise<string | undefined> {
  if (batch.playlistId) return batch.playlistId;
  if (batch.playlistName) {
    const id = await createPlaylist(batch.playlistName);
    batch.playlistId = id;
    return id;
  }
}

export async function runBatch(batch: ImportBatch): Promise<void> {
  const saver = setInterval(save, 2000);
  try {
    const playlistId = await resolvePlaylist(batch);

    const ok = await ensureLoggedIn();
    if (!ok) {
      batch.error = "deemix not logged in (check DEEMIX_ARL / Deezer availability)";
    }

    await searchAndDownload(batch);
    await scanAfterDownload(batch);
    await matchAndAddToPlaylist(batch, playlistId);
  } catch (e) {
    batch.error = e instanceof Error ? e.message : String(e);
  } finally {
    batch.done = true;
    clearInterval(saver);
    save();
    bust("songs", "playlists");
  }
}
