import "server-only";
import { env, isNavidromeConfigured } from "./env";
import { getSongs } from "./native";
import { ping, getPlaylists, search3Songs, getPlaylistSongs } from "./subsonic";
import { status as deemixStatus } from "./deemix";
import { sampleSongs, samplePlaylists } from "./sample-data";
import type { Playlist, Song, SongQuery, SongSortKey, SongsResult } from "./types";

/**
 * Data-access layer used by pages and the /api/songs route. Returns live
 * Navidrome data when configured, otherwise falls back to the sample library
 * so the UI is always explorable — every fallback is surfaced, never silent.
 *
 * Sorting, filtering and pagination are all resolved server-side, so a re-sort
 * re-queries the whole library rather than reordering an already-loaded page.
 */

export async function getLibrarySongs(q: SongQuery): Promise<SongsResult> {
  const search = q.search?.trim();

  if (!isNavidromeConfigured) {
    return { ...processInMemory(sampleSongs, q, search), source: "sample" };
  }

  try {
    // Scoped to a playlist: playlists are small, so fetch whole then process.
    if (q.playlistId) {
      const rows = await getPlaylistSongs(q.playlistId);
      return { ...processInMemory(rows, q, search), source: "navidrome" };
    }

    // Free-text search: cross-field via stable Subsonic search3.
    if (search) {
      const pageSize = q.end - q.start;
      let songs = await search3Songs(search, q.start, pageSize);
      if (q.favoritesOnly) songs = songs.filter((s) => s.starred);
      // search3 gives no total; signal "maybe more" when the page came back full.
      const total = q.start + songs.length + (songs.length === pageSize ? pageSize : 0);
      return { songs, total, source: "navidrome" };
    }

    // Default browse: server-side sort + pagination via the Native API.
    const { songs, total } = await getSongs({
      start: q.start,
      end: q.end,
      sort: q.sort,
      order: q.order,
      starred: q.favoritesOnly,
    });
    return { songs, total, source: "navidrome" };
  } catch (err) {
    const fallback = processInMemory(sampleSongs, q, search);
    return {
      ...fallback,
      source: "sample",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Apply search + favourites filter + sort + pagination to an in-memory list. */
function processInMemory(
  all: Song[],
  q: SongQuery,
  search?: string,
): { songs: Song[]; total: number } {
  let rows = all;
  if (search) {
    const needle = search.toLowerCase();
    rows = rows.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.artist.toLowerCase().includes(needle) ||
        s.album.toLowerCase().includes(needle),
    );
  }
  if (q.favoritesOnly) rows = rows.filter((s) => s.starred);
  rows = [...rows].sort(compareBy(q.sort, q.order));
  return { songs: rows.slice(q.start, q.end), total: rows.length };
}

function compareBy(sort: SongSortKey, order: "ASC" | "DESC") {
  const dir = order === "ASC" ? 1 : -1;
  const val = (s: Song): string | number => {
    switch (sort) {
      case "playCount":
        return s.playCount;
      case "createdAt":
        return s.createdAt ? Date.parse(s.createdAt) : 0;
      case "lastPlayed":
        return s.lastPlayed ? Date.parse(s.lastPlayed) : 0;
      default:
        return s[sort].toLowerCase();
    }
  };
  return (a: Song, b: Song) => {
    const av = val(a);
    const bv = val(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  };
}

export async function getLibraryPlaylists(): Promise<{
  playlists: Playlist[];
  source: "navidrome" | "sample";
}> {
  if (!isNavidromeConfigured) return { playlists: samplePlaylists, source: "sample" };
  try {
    return { playlists: await getPlaylists(), source: "navidrome" };
  } catch {
    return { playlists: samplePlaylists, source: "sample" };
  }
}

export interface SystemStatus {
  navidrome: { configured: boolean; reachable: boolean; url: string };
  deemix: {
    configured: boolean;
    reachable: boolean;
    deezerAvailable: boolean;
    loggedIn: boolean;
    url: string;
  };
  paths: { music: string; trash: string; database: string };
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const [navReachable, dmx] = await Promise.all([
    isNavidromeConfigured ? ping() : Promise.resolve(false),
    deemixStatus(),
  ]);
  return {
    navidrome: {
      configured: isNavidromeConfigured,
      reachable: navReachable,
      url: env.NAVIDROME_URL,
    },
    deemix: {
      configured: true,
      reachable: dmx.reachable,
      deezerAvailable: dmx.deezerAvailable,
      loggedIn: dmx.loggedIn,
      url: env.DEEMIX_URL,
    },
    paths: { music: env.MUSIC_DIR, trash: env.TRASH_DIR, database: env.DATABASE_PATH },
  };
}
