import "server-only";
import { env } from "./env";
import type { Song } from "./types";

/**
 * Navidrome NATIVE API client (`/api/*`) — the UNSTABLE surface.
 *
 * This is the ONLY module allowed to touch `/api/*`. It is undocumented and
 * can change between Navidrome versions, so a breakage here should be a
 * one-file fix. Pin the Navidrome image version in production.
 *
 * We need it purely for the sortable/filterable flat song list with play
 * counts that Subsonic doesn't serve well.
 */

let cachedToken: { token: string; at: number } | null = null;
const TOKEN_TTL_MS = 10 * 60 * 1000;

async function login(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < TOKEN_TTL_MS) {
    return cachedToken.token;
  }
  const res = await fetch(`${env.NAVIDROME_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: env.NAVIDROME_USERNAME,
      password: env.NAVIDROME_PASSWORD,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Native login → HTTP ${res.status}`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("Native login → no token in response");
  cachedToken = { token: body.token, at: Date.now() };
  return body.token;
}

export type SongSort =
  | "title"
  | "artist"
  | "album"
  | "playCount"
  | "createdAt"
  | "playDate";

export interface GetSongsOptions {
  start?: number;
  end?: number;
  sort?: SongSort;
  order?: "ASC" | "DESC";
  search?: string;
}

interface RawSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  playCount?: number;
  starred?: boolean;
  path?: string;
  createdAt?: string;
  playDate?: string;
}

function mapSong(s: RawSong): Song {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    durationSecs: Math.round(s.duration ?? 0),
    playCount: s.playCount ?? 0,
    starred: Boolean(s.starred),
    path: s.path,
    createdAt: s.createdAt,
    lastPlayed: s.playDate,
  };
}

export async function getSongs(opts: GetSongsOptions = {}): Promise<Song[]> {
  const token = await login();
  const params = new URLSearchParams({
    _start: String(opts.start ?? 0),
    _end: String(opts.end ?? 100),
    _sort: opts.sort ?? "title",
    _order: opts.order ?? "ASC",
  });
  if (opts.search) params.set("title", opts.search);

  const res = await fetch(`${env.NAVIDROME_URL}/api/song?${params.toString()}`, {
    headers: { "x-nd-authorization": `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Native getSongs → HTTP ${res.status}`);
  const rows = (await res.json()) as RawSong[];
  return rows.map(mapSong);
}
