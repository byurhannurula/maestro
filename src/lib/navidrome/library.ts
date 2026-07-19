import "server-only";
import { cache } from "react";
import { status as deemixStatus } from "@/lib/deemix";
import { env, isNavidromeConfigured } from "@/lib/env";
import { buildDuplicateGroups, normArtist, trackKey } from "@/lib/navidrome/dedupe";
import { getSongs } from "@/lib/navidrome/native";
import { ping, getPlaylists, search3Songs, getPlaylistSongs } from "@/lib/navidrome/subsonic";
import { sampleSongs, samplePlaylists } from "@/lib/sample-data";
import { cached } from "@/lib/storage/cache";
import type {
  DuplicatesResult,
  Playlist,
  Song,
  SongQuery,
  SongSortKey,
  SongsResult,
} from "@/lib/types";

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
    let pool = q.unplayedOnly ? sampleSongs.filter((s) => s.playCount === 0) : sampleSongs;
    if (q.unplayedOnly) pool = applyStaleCutoff(pool, q.staleDays);
    return { ...processInMemory(pool, q, search), source: "sample" };
  }

  try {
    // Cleanup: never-played tracks. The play_count *filter* is unreliable
    // (unplayed rows store NULL, not 0), but sorting by playCount ASC puts all
    // zeros contiguously at the top. This block is small (~hundreds of rows), so
    // fetch it whole and return an exact list — no fragile boundary paging, and
    // the age cutoff can be applied cleanly without desyncing offsets.
    if (q.unplayedOnly) {
      const zeros = await fetchNeverPlayed(search, q.favoritesOnly);
      const songs = applyStaleCutoff(zeros, q.staleDays);
      return { songs, total: songs.length, source: "navidrome" };
    }

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

/**
 * Fetch the whole never-played block (playCount 0). Pages through the Native API
 * sorted by playCount ASC and stops at the first played track. Bounded by a cap
 * so a misbehaving sort can't loop forever.
 */
async function fetchNeverPlayed(search?: string, favoritesOnly?: boolean): Promise<Song[]> {
  const PAGE = 500;
  const CAP = 20_000;
  const zeros: Song[] = [];
  let offset = 0;
  while (offset < CAP) {
    const { songs } = await getSongs({
      start: offset,
      end: offset + PAGE,
      sort: "playCount",
      order: "ASC",
      search,
      starred: favoritesOnly,
    });
    let boundary = false;
    for (const s of songs) {
      if (s.playCount === 0) zeros.push(s);
      else {
        boundary = true;
        break;
      }
    }
    if (boundary || songs.length < PAGE) break;
    offset += songs.length;
  }
  return zeros;
}

/** Drop never-played tracks that were added more recently than `days` ago. */
function applyStaleCutoff(songs: Song[], days?: number): Song[] {
  if (!days || days <= 0) return songs;
  const cutoff = Date.now() - days * 86_400_000;
  // Unknown createdAt → treat as old (keep); Navidrome always sets it in practice.
  return songs.filter((s) => !s.createdAt || Date.parse(s.createdAt) <= cutoff);
}

// ---------------------------------------------------------------------------
// Duplicate detection (read-only). Groups tracks whose normalised artist+title
// collide — catching re-downloads and near-identical tags. Remix/version
// qualifiers stay in the key (conservative), so distinct cuts don't merge.
// ---------------------------------------------------------------------------

/** Fetch the entire library (paged, bounded). Pages are individually cached. */
async function fetchAllSongs(): Promise<Song[]> {
  const PAGE = 500;
  const CAP = 20_000;
  const out: Song[] = [];
  let offset = 0;
  while (offset < CAP) {
    const { songs } = await getSongs({
      start: offset,
      end: offset + PAGE,
      sort: "title",
      order: "ASC",
    });
    out.push(...songs);
    if (songs.length < PAGE) break;
    offset += songs.length;
  }
  return out;
}

/** Normalized `artist␟title` keys for the whole library — lets Discovery flag
 *  recommendations you already own. Cached under the songs tag. */
export async function getLibraryKeys(): Promise<Set<string>> {
  if (!isNavidromeConfigured) return new Set();
  return cached("library-keys", ["songs"], async () => {
    const all = await fetchAllSongs();
    return new Set(all.map((s) => trackKey(s.artist, s.title)));
  });
}

/** Most-played artists (falls back to song count when nothing's scrobbled). */
export async function getTopArtists(n: number): Promise<string[]> {
  if (!isNavidromeConfigured) return [];
  return cached(`top-artists:${n}`, ["songs"], async () => {
    const all = await fetchAllSongs();
    const plays = new Map<string, number>();
    const count = new Map<string, number>();
    for (const s of all) {
      if (!s.artist) continue;
      plays.set(s.artist, (plays.get(s.artist) ?? 0) + (s.playCount || 0));
      count.set(s.artist, (count.get(s.artist) ?? 0) + 1);
    }
    return [...plays.keys()]
      .sort((a, b) => plays.get(b)! - plays.get(a)! || count.get(b)! - count.get(a)!)
      .slice(0, n);
  });
}

/** Most-played tracks (only those actually played). */
export async function getTopTracks(n: number): Promise<{ artist: string; title: string }[]> {
  if (!isNavidromeConfigured) return [];
  return cached(`top-tracks:${n}`, ["songs"], async () => {
    const all = await fetchAllSongs();
    return all
      .filter((s) => (s.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, n)
      .map((s) => ({ artist: s.artist, title: s.title }));
  });
}

/** Set of normalized artist keys already in the library. */
export async function getLibraryArtistKeys(): Promise<Set<string>> {
  if (!isNavidromeConfigured) return new Set();
  return cached("library-artists", ["songs"], async () => {
    const all = await fetchAllSongs();
    return new Set(all.map((s) => normArtist(s.artist)).filter(Boolean));
  });
}

export async function getDuplicateGroups(aggressive: boolean): Promise<DuplicatesResult> {
  if (!isNavidromeConfigured) return buildDuplicateGroups(sampleSongs, aggressive, "sample");
  try {
    const all = await fetchAllSongs();
    return buildDuplicateGroups(all, aggressive, "navidrome");
  } catch (err) {
    return {
      ...buildDuplicateGroups(sampleSongs, aggressive, "sample"),
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

// Wrapped in React cache(): the layout and the page both call this in one
// request, so they share a single Subsonic round-trip instead of two.
export const getLibraryPlaylists = cache(
  async (): Promise<{ playlists: Playlist[]; source: "navidrome" | "sample" }> => {
    if (!isNavidromeConfigured) return { playlists: samplePlaylists, source: "sample" };
    try {
      return { playlists: await getPlaylists(), source: "navidrome" };
    } catch {
      return { playlists: samplePlaylists, source: "sample" };
    }
  },
);

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

export interface LibraryStats {
  totalTracks: number;
  favourites: number;
  neverPlayed: number;
  playlists: number;
  playlistTracks: number;
  playlistDurationSecs: number;
}

/** Headline counts for the System page. Individual reads are cached. */
export async function getLibraryStats(): Promise<LibraryStats> {
  const { playlists } = await getLibraryPlaylists();
  const plAgg = {
    playlists: playlists.length,
    playlistTracks: playlists.reduce((n, p) => n + p.songCount, 0),
    playlistDurationSecs: playlists.reduce((n, p) => n + p.durationSecs, 0),
  };

  if (!isNavidromeConfigured) {
    return {
      totalTracks: sampleSongs.length,
      favourites: sampleSongs.filter((s) => s.starred).length,
      neverPlayed: sampleSongs.filter((s) => s.playCount === 0).length,
      ...plAgg,
    };
  }

  try {
    const [all, faves, unplayed] = await Promise.all([
      getSongs({ start: 0, end: 1 }),
      getSongs({ start: 0, end: 1, starred: true }),
      fetchNeverPlayed(),
    ]);
    return {
      totalTracks: all.total,
      favourites: faves.total,
      neverPlayed: unplayed.length,
      ...plAgg,
    };
  } catch {
    return { totalTracks: 0, favourites: 0, neverPlayed: 0, ...plAgg };
  }
}
