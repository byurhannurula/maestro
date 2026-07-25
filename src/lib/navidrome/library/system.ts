import "server-only";
import { cache } from "react";
import { status as deemixStatus } from "@/lib/deemix";
import { env, isNavidromeConfigured } from "@/lib/env";
import { ping, getPlaylists } from "@/lib/navidrome/subsonic";
import { samplePlaylists } from "@/lib/sample-data";
import type { Playlist } from "@/lib/types";

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
