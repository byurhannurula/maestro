import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "./env";
import type { Playlist, Song } from "./types";

/**
 * Subsonic API client (`/rest/*`) — the STABLE surface.
 * Used for actions Navidrome supports reliably across versions:
 * search, star/unstar, playlist CRUD, triggering scans.
 */

const CLIENT = "maestro";
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

async function request<T = unknown>(endpoint: string, params: URLSearchParams): Promise<T> {
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

async function call<T = unknown>(
  endpoint: string,
  extra: Record<string, string> = {},
): Promise<T> {
  const params = authParams();
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
  return request<T>(endpoint, params);
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

/** Star or unstar many songs in one call. */
export async function setStarred(ids: string[], starred: boolean): Promise<void> {
  if (ids.length === 0) return;
  const params = authParams();
  for (const id of ids) params.append("id", id);
  await request(starred ? "star.view" : "unstar.view", params);
}

/** Add many songs to a playlist in one call. */
export async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<void> {
  if (songIds.length === 0) return;
  const params = authParams();
  params.set("playlistId", playlistId);
  for (const id of songIds) params.append("songIdToAdd", id);
  await request("updatePlaylist.view", params);
}

export async function createPlaylist(name: string): Promise<string> {
  const res = await call<{ playlist?: { id: string } }>("createPlaylist.view", { name });
  return res.playlist?.id ?? "";
}

export async function deletePlaylist(id: string): Promise<void> {
  await call("deletePlaylist.view", { id });
}

interface RawSubsonicSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverArt?: string;
  duration?: number;
  playCount?: number;
  starred?: string;
  path?: string;
  created?: string;
  played?: string;
}

function mapSubsonicSong(s: RawSubsonicSong): Song {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    durationSecs: Math.round(s.duration ?? 0),
    playCount: s.playCount ?? 0,
    starred: Boolean(s.starred),
    coverArt: s.coverArt ?? s.id,
    path: s.path,
    createdAt: s.created,
    lastPlayed: s.played,
  };
}

/**
 * Cross-field song search (title/artist/album) via the stable Subsonic API.
 * Used when the browser has a search term — search3 handles fuzzy matching
 * that the Native API's single-field filter can't. Results are relevance-ordered.
 */
export async function search3Songs(
  query: string,
  offset: number,
  count: number,
): Promise<Song[]> {
  const res = await call<{ searchResult3?: { song?: RawSubsonicSong[] } }>("search3.view", {
    query,
    songCount: String(count),
    songOffset: String(offset),
    artistCount: "0",
    albumCount: "0",
  });
  return (res.searchResult3?.song ?? []).map(mapSubsonicSong);
}

/** All tracks in a playlist (playlists are small, so fetched whole). */
export async function getPlaylistSongs(id: string): Promise<Song[]> {
  const res = await call<{ playlist?: { entry?: RawSubsonicSong[] } }>("getPlaylist.view", { id });
  return (res.playlist?.entry ?? []).map(mapSubsonicSong);
}

/** Server-side authed cover-art URL (proxied by /api/cover, never sent to the browser). */
export function coverArtUrl(id: string, size = 80): string {
  const params = authParams();
  params.set("id", id);
  params.set("size", String(size));
  return `${env.NAVIDROME_URL}/rest/getCoverArt.view?${params.toString()}`;
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
