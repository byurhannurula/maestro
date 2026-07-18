import "server-only";
import { randomUUID } from "node:crypto";
import type { Song } from "./types";
import type { DeezerTrack } from "./deemix";

/**
 * In-memory import-job store. A single long-running server process owns it, so
 * the UI can poll live status. Not persisted across restarts (acceptable for a
 * single-user tool; SQLite persistence is a possible later upgrade).
 */

export type JobStatus =
  | "queued"
  | "searching"
  | "not_found"
  | "downloading"
  | "download_failed"
  | "scanning"
  | "matching"
  | "needs_review"
  | "added"
  | "add_failed";

export interface ImportJob {
  id: string;
  line: string;
  artist?: string;
  title?: string;
  searchQuery: string;
  status: JobStatus;
  deezer?: DeezerTrack;
  matchedSongId?: string;
  candidates?: Song[];
  error?: string;
}

export interface ImportBatch {
  id: string;
  createdAt: number;
  playlistId?: string;
  playlistName?: string;
  jobs: ImportJob[];
  done: boolean;
  error?: string;
}

// Survive Turbopack/HMR module reloads in dev.
const store: Map<string, ImportBatch> = ((
  globalThis as unknown as { __maestroImport?: Map<string, ImportBatch> }
).__maestroImport ??= new Map());

export function createBatch(
  jobs: Omit<ImportJob, "id" | "status">[],
  target: { playlistId?: string; playlistName?: string },
): ImportBatch {
  const batch: ImportBatch = {
    id: randomUUID(),
    createdAt: Date.now(),
    playlistId: target.playlistId,
    playlistName: target.playlistName,
    jobs: jobs.map((j) => ({ ...j, id: randomUUID(), status: "queued" as JobStatus })),
    done: false,
  };
  store.set(batch.id, batch);
  return batch;
}

export function getBatch(id: string): ImportBatch | undefined {
  return store.get(id);
}
