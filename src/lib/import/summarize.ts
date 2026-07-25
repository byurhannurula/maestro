import type { ImportBatch, ImportJob, JobStatus } from "@/lib/import/store";

export const ACTIVE: JobStatus[] = ["queued", "searching", "downloading", "scanning", "matching"];
export const FAILED: JobStatus[] = ["not_found", "download_failed", "add_failed"];
export const NO_PLAYLIST = "No playlist";

export type Filter = "all" | "review" | "failed";

export interface Counts {
  added: number;
  review: number;
  failed: number;
  skipped: number;
  active: number;
}

export function summarize(jobs: ImportJob[]): Counts {
  const c: Counts = { added: 0, review: 0, failed: 0, skipped: 0, active: 0 };
  for (const j of jobs) {
    if (j.status === "added") c.added++;
    else if (j.status === "needs_review") c.review++;
    else if (j.status === "skipped") c.skipped++;
    else if (FAILED.includes(j.status)) c.failed++;
    else c.active++;
  }
  return c;
}

export const isFailed = (j: ImportJob) => FAILED.includes(j.status);

export function batchTitle(b: ImportBatch, playlists: { id: string; name: string }[]): string {
  return b.playlistName ?? playlists.find((p) => p.id === b.playlistId)?.name ?? NO_PLAYLIST;
}
