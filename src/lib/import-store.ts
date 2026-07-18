import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "./env";
import type { Song } from "./types";
import type { DeezerTrack } from "./deemix";

/**
 * Import-job store: kept in memory for live polling, and mirrored to a JSON file
 * so history survives a server restart / redeploy. A single long-running process
 * owns it (single-user tool), so no locking is needed.
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
  | "add_failed"
  | "skipped";

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

const MAX_BATCHES = 50;
const FILE = join(dirname(env.DATABASE_PATH), "imports.json");

interface StoreShape {
  map: Map<string, ImportBatch>;
}

function load(): Map<string, ImportBatch> {
  try {
    const raw = readFileSync(FILE, "utf8");
    const arr = JSON.parse(raw) as ImportBatch[];
    return new Map(arr.map((b) => [b.id, b]));
  } catch {
    return new Map();
  }
}

// Survive Turbopack/HMR reloads in dev; load from disk on cold start.
const g = globalThis as unknown as { __maestroImport?: StoreShape };
if (!g.__maestroImport || !(g.__maestroImport.map instanceof Map)) {
  g.__maestroImport = { map: load() };
}
const store = g.__maestroImport.map;

export function save(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    // newest first, capped
    const arr = [...store.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_BATCHES);
    writeFileSync(FILE, JSON.stringify(arr));
  } catch {
    /* best-effort; in dev the /data dir may not exist */
  }
}

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
  // prune oldest beyond the cap
  if (store.size > MAX_BATCHES) {
    const oldest = [...store.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) store.delete(oldest.id);
  }
  save();
  return batch;
}

export function getBatch(id: string): ImportBatch | undefined {
  return store.get(id);
}

export function listBatches(): ImportBatch[] {
  return [...store.values()].sort((a, b) => b.createdAt - a.createdAt);
}
