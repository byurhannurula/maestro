import "server-only";
import { cache } from "react";
import { env, isNavidromeConfigured } from "./env";
import { getSongs } from "./native";
import { ping, getPlaylists, search3Songs, getPlaylistSongs } from "./subsonic";
import { status as deemixStatus } from "./deemix";
import { sampleSongs, samplePlaylists } from "./sample-data";
import type {
  DataSource,
  DuplicateGroup,
  DuplicatesResult,
  Playlist,
  Song,
  SongQuery,
  SongSortKey,
  SongsResult,
} from "./types";

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
    const { songs } = await getSongs({ start: offset, end: offset + PAGE, sort: "title", order: "ASC" });
    out.push(...songs);
    if (songs.length < PAGE) break;
    offset += songs.length;
  }
  return out;
}

const foldBase = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Primary-artist key: first artist only, feat/collab tails dropped. */
function normArtist(a: string): string {
  const primary =
    foldBase(a).split(/\s*(?:,|&|;|\/|·|•|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bx\b)\s*/)[0] ?? "";
  return primary.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

// Non-distinguishing qualifiers stripped only in aggressive mode (these are
// usually the *same* recording). Remix/extended/instrumental/acoustic/live are
// deliberately NOT here — those are genuinely different tracks.
const AGGRESSIVE_QUALIFIERS =
  "remaster(?:ed)?(?:\\s*\\d{4})?|\\d{4}\\s*remaster(?:ed)?|radio edit|radio mix|" +
  "single version|album version|original version|mono|stereo|deluxe|bonus track|explicit|clean";

function normTitle(t: string, aggressive: boolean): string {
  let s = foldBase(t);
  // Always drop "(feat. …)" / "[ft …]" and trailing "feat …" clutter (with or
  // without a leading dash). \b guards against words like "feature"/"defeat".
  s = s.replace(/[([{]\s*(?:feat|ft|featuring)\b[^)\]}]*[)\]}]/g, " ");
  s = s.replace(/\s+(?:[-–—]\s*)?(?:feat|ft|featuring)\b\.?\s.*$/g, " ");
  if (aggressive) {
    const re = new RegExp(
      `[([{]\\s*(?:${AGGRESSIVE_QUALIFIERS})[^)\\]}]*[)\\]}]|\\s[-–—]\\s*(?:${AGGRESSIVE_QUALIFIERS})\\b.*$`,
      "g",
    );
    s = s.replace(re, " ");
  }
  return s.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Suggested keeper first: most-played, then best quality, then oldest. */
function keeperCompare(a: Song, b: Song): number {
  return (
    b.playCount - a.playCount ||
    (b.bitRate ?? 0) - (a.bitRate ?? 0) ||
    (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0) ||
    (Date.parse(a.createdAt ?? "") || 0) - (Date.parse(b.createdAt ?? "") || 0)
  );
}

function buildDuplicateGroups(all: Song[], aggressive: boolean, source: DataSource): DuplicatesResult {
  const map = new Map<string, Song[]>();
  for (const s of all) {
    const title = normTitle(s.title, aggressive);
    if (!title) continue; // untitled — can't match reliably
    const key = `${normArtist(s.artist)}␟${title}`;
    const arr = map.get(key);
    if (arr) arr.push(s);
    else map.set(key, [s]);
  }

  const groups: DuplicateGroup[] = [];
  let duplicateTracks = 0;
  for (const [key, members] of map) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(keeperCompare);
    const durs = sorted.map((m) => m.durationSecs);
    const versionsDiffer = Math.max(...durs) - Math.min(...durs) > 3;
    const reclaimableBytes = sorted.slice(1).reduce((n, m) => n + (m.sizeBytes ?? 0), 0);
    groups.push({ key, artist: sorted[0].artist, title: sorted[0].title, members: sorted, versionsDiffer, reclaimableBytes });
    duplicateTracks += members.length;
  }
  // Most copies first, then most space reclaimable.
  groups.sort((a, b) => b.members.length - a.members.length || b.reclaimableBytes - a.reclaimableBytes);
  return { groups, source, scanned: all.length, duplicateTracks };
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
