import "server-only";
import { isNavidromeConfigured } from "@/lib/env";
import { buildDuplicateGroups } from "@/lib/navidrome/dedupe";
import { fetchAllSongs } from "@/lib/navidrome/library/songs";
import { getLibraryPlaylists } from "@/lib/navidrome/library/system";
import { getSongs } from "@/lib/navidrome/native";
import { sampleSongs } from "@/lib/sample-data";
import { cached } from "@/lib/storage/cache";
import type { DuplicatesResult } from "@/lib/types";

export interface LibraryStats {
  totalTracks: number;
  favourites: number;
  neverPlayed: number;
  playlists: number;
  playlistTracks: number;
  playlistDurationSecs: number;
}

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

async function fetchNeverPlayed(): Promise<import("@/lib/types").Song[]> {
  const PAGE = 500;
  const CAP = 20_000;
  const zeros: import("@/lib/types").Song[] = [];
  let offset = 0;
  while (offset < CAP) {
    const { songs } = await getSongs({
      start: offset,
      end: offset + PAGE,
      sort: "playCount",
      order: "ASC",
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
