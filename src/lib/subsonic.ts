import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "./env";
import type { Playlist } from "./types";

/**
 * Subsonic API client (`/rest/*`) — the STABLE surface.
 * Used for actions Navidrome supports reliably across versions:
 * search, star/unstar, playlist CRUD, triggering scans.
 */

const CLIENT = "navi-organiser";
const API_VERSION = "1.16.1";

function authParams(): URLSearchParams {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5")
    .update(env.NAVIDROME_PASSWORD + salt)
    .digest("hex");
  return new URLSearchParams({
    u: env.NAVIDROME_USERNAME,
    t: token,
    s: salt,
    v: API_VERSION,
    c: CLIENT,
    f: "json",
  });
}

async function call<T = unknown>(
  endpoint: string,
  extra: Record<string, string> = {},
): Promise<T> {
  const params = authParams();
  for (const [k, v] of Object.entries(extra)) params.set(k, v);

  const url = `${env.NAVIDROME_URL}/rest/${endpoint}?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Subsonic ${endpoint} → HTTP ${res.status}`);

  const body = await res.json();
  const sub = body["subsonic-response"];
  if (!sub || sub.status !== "ok") {
    throw new Error(`Subsonic ${endpoint} → ${sub?.error?.message ?? "unknown error"}`);
  }
  return sub as T;
}

export async function ping(): Promise<boolean> {
  try {
    await call("ping.view");
    return true;
  } catch {
    return false;
  }
}

interface RawPlaylist {
  id: string;
  name: string;
  songCount: number;
  duration: number;
  public?: boolean;
}

export async function getPlaylists(): Promise<Playlist[]> {
  const res = await call<{ playlists?: { playlist?: RawPlaylist[] } }>("getPlaylists.view");
  return (res.playlists?.playlist ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    songCount: p.songCount,
    durationSecs: p.duration,
    public: Boolean(p.public),
  }));
}

export async function star(id: string): Promise<void> {
  await call("star.view", { id });
}

export async function unstar(id: string): Promise<void> {
  await call("unstar.view", { id });
}

export async function addToPlaylist(playlistId: string, songId: string): Promise<void> {
  await call("updatePlaylist.view", { playlistId, songIdToAdd: songId });
}

export async function createPlaylist(name: string): Promise<string> {
  const res = await call<{ playlist?: { id: string } }>("createPlaylist.view", { name });
  return res.playlist?.id ?? "";
}

export async function startScan(): Promise<void> {
  await call("startScan.view");
}

export async function getScanStatus(): Promise<{ scanning: boolean; count: number }> {
  const res = await call<{ scanStatus?: { scanning: boolean; count: number } }>(
    "getScanStatus.view",
  );
  return {
    scanning: Boolean(res.scanStatus?.scanning),
    count: res.scanStatus?.count ?? 0,
  };
}
