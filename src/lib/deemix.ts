import "server-only";
import { env } from "./env";

/**
 * deemix webui REST client (bambanah/deemix).
 * Verified endpoints: /api/connect, /api/search, /api/addToQueue, /api/getQueue.
 * The app resolves each import line to a single TRACK url and queues that —
 * never a playlist url — to avoid deemix's per-playlist folder duplication.
 */

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${env.DEEMIX_URL}/api/${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`deemix GET ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.DEEMIX_URL}/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`deemix POST ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface DeemixStatus {
  reachable: boolean;
  deezerAvailable: boolean;
  spotifyEnabled: boolean;
  loggedIn: boolean;
}

export async function status(): Promise<DeemixStatus> {
  try {
    const r = await get<{
      deezerAvailable?: boolean;
      spotifyEnabled?: boolean;
      currentUser?: { id?: number } | null;
    }>("connect");
    return {
      reachable: true,
      deezerAvailable: Boolean(r.deezerAvailable),
      spotifyEnabled: Boolean(r.spotifyEnabled),
      loggedIn: Boolean(r.currentUser?.id),
    };
  } catch {
    return { reachable: false, deezerAvailable: false, spotifyEnabled: false, loggedIn: false };
  }
}

export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  link: string;
}

interface RawSearchResult {
  data?: Array<{
    id: number;
    title: string;
    artist?: { name?: string };
    link?: string;
  }>;
}

export async function searchTrack(term: string, limit = 5): Promise<DeezerTrack[]> {
  const r = await get<RawSearchResult>("search", {
    term,
    type: "track",
    start: "0",
    nb: String(limit),
  });
  return (r.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist?.name ?? "",
    link: t.link ?? `https://www.deezer.com/track/${t.id}`,
  }));
}

/** Queue one or more Deezer track URLs. bitrate: "" uses deemix's configured max. */
export async function addToQueue(url: string, bitrate = ""): Promise<{ result: boolean }> {
  return post<{ result: boolean }>("addToQueue", { url, bitrate });
}

export async function getQueue(): Promise<unknown> {
  return get("getQueue");
}
