import "server-only";
import { env, isNavidromeConfigured } from "./env";
import { getSongs, type GetSongsOptions } from "./native";
import { ping } from "./subsonic";
import { status as deemixStatus } from "./deemix";
import { sampleSongs, samplePlaylists } from "./sample-data";
import { getPlaylists } from "./subsonic";
import type { Playlist, SongsResult } from "./types";

/**
 * Data-access layer used by pages. Returns live Navidrome data when
 * configured, otherwise falls back to the sample library so the UI is always
 * explorable — every fallback is surfaced in the UI, never silent.
 */

export async function getLibrarySongs(opts: GetSongsOptions = {}): Promise<SongsResult> {
  if (!isNavidromeConfigured) {
    return { songs: sampleSongs, source: "sample" };
  }
  try {
    const songs = await getSongs(opts);
    return { songs, source: "navidrome" };
  } catch (err) {
    return {
      songs: sampleSongs,
      source: "sample",
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
