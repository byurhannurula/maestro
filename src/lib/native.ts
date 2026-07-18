import "server-only";
import { env } from "./env";
import type { Song, SongSortKey } from "./types";

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

export interface GetSongsOptions {
  start?: number;
  end?: number;
  sort?: SongSortKey;
  order?: "ASC" | "DESC";
  search?: string;
  starred?: boolean;
  /** Extra raw filter params passed through to the Native API. */
  filters?: Record<string, string>;
}

/** Map our sort keys to the Native API's `_sort` field names. */
const SORT_FIELD: Record<SongSortKey, string> = {
  title: "title",
  artist: "artist",
  album: "album",
  playCount: "playCount",
  createdAt: "createdAt",
  lastPlayed: "playDate",
};

interface RawSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
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
    coverArt: s.albumId ?? s.id,
    path: s.path,
    createdAt: s.createdAt,
    lastPlayed: s.playDate,
  };
}

export async function getSongs(
  opts: GetSongsOptions = {},
): Promise<{ songs: Song[]; total: number }> {
  const token = await login();
  const start = opts.start ?? 0;
  const end = opts.end ?? 100;
  const params = new URLSearchParams({
    _start: String(start),
    _end: String(end),
    _sort: SORT_FIELD[opts.sort ?? "title"],
    _order: opts.order ?? "ASC",
  });
  if (opts.search) params.set("title", opts.search);
  if (opts.starred) params.set("starred", "true");
  if (opts.filters) for (const [k, v] of Object.entries(opts.filters)) params.set(k, v);

  const res = await fetch(`${env.NAVIDROME_URL}/api/song?${params.toString()}`, {
    headers: { "x-nd-authorization": `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Native getSongs → HTTP ${res.status}`);

  const rows = (await res.json()) as RawSong[];
  const songs = rows.map(mapSong);
  // Navidrome returns the full match count in the react-admin total header.
  const totalHeader = res.headers.get("x-total-count");
  const total = totalHeader ? Number(totalHeader) : start + songs.length;
  return { songs, total };
}
