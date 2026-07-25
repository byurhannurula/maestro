import "server-only";
import { isNavidromeConfigured } from "@/lib/env";
import { trackKey, normArtist } from "@/lib/navidrome/dedupe";
import { getSongs } from "@/lib/navidrome/native";
import { applyStaleCutoff, processInMemory } from "@/lib/navidrome/query";
import { search3Songs, getPlaylistSongs } from "@/lib/navidrome/subsonic";
import { sampleSongs } from "@/lib/sample-data";
import { cached } from "@/lib/storage/cache";
import type { Song, SongQuery, SongsResult } from "@/lib/types";

export async function getLibrarySongs(q: SongQuery): Promise<SongsResult> {
  const search = q.search?.trim();

  if (!isNavidromeConfigured) {
    let pool = q.unplayedOnly ? sampleSongs.filter((s) => s.playCount === 0) : sampleSongs;
    if (q.unplayedOnly) pool = applyStaleCutoff(pool, q.staleDays);
    return { ...processInMemory(pool, q, search), source: "sample" };
  }

  try {
    if (q.unplayedOnly) {
      const zeros = await fetchNeverPlayed(search, q.favoritesOnly);
      const songs = applyStaleCutoff(zeros, q.staleDays);
      return { songs, total: songs.length, source: "navidrome" };
    }

    if (q.playlistId) {
      const rows = await getPlaylistSongs(q.playlistId);
      return { ...processInMemory(rows, q, search), source: "navidrome" };
    }

    if (search) {
      const pageSize = q.end - q.start;
      let songs = await search3Songs(search, q.start, pageSize);
      if (q.favoritesOnly) songs = songs.filter((s) => s.starred);
      const total = q.start + songs.length + (songs.length === pageSize ? pageSize : 0);
      return { songs, total, source: "navidrome" };
    }

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

export async function fetchAllSongs(): Promise<Song[]> {
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

export async function getLibraryKeys(): Promise<Set<string>> {
  if (!isNavidromeConfigured) return new Set();
  return cached("library-keys", ["songs"], async () => {
    const all = await fetchAllSongs();
    return new Set(all.map((s) => trackKey(s.artist, s.title)));
  });
}

export async function getLibraryArtistKeys(): Promise<Set<string>> {
  if (!isNavidromeConfigured) return new Set();
  return cached("library-artists", ["songs"], async () => {
    const all = await fetchAllSongs();
    return new Set(all.map((s) => normArtist(s.artist)).filter(Boolean));
  });
}
