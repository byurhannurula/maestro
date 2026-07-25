import "server-only";
import { mapLimit } from "@/lib/concurrency";
import { lookupTrack } from "@/lib/deezer";
import { dedupeTrackCandidates, dedupeArtistCandidates } from "@/lib/discovery/candidates";
import { enrichTrack } from "@/lib/discovery/enrich";
import { isDiscoveryConfigured, isLastfmConfigured } from "@/lib/env";
import { getSimilarArtists, getSimilarTracks, getArtistTopTracks } from "@/lib/lastfm";
import { getRecommendationPlaylists, getPlaylistTracks } from "@/lib/listenbrainz";
import {
  getLibraryKeys,
  getLibraryArtistKeys,
  getTopArtists,
  getTopTracks,
} from "@/lib/navidrome/library";
import { cached } from "@/lib/storage/cache";
import type { RawTrack } from "@/lib/discovery/enrich";
import type { DiscoveryArtist, DiscoveryPlaylist, DiscoveryTrack } from "@/lib/types";

const SUBTITLES: Record<string, string> = {
  "Weekly Exploration": "New music · refreshed weekly",
  "Weekly Jams": "Familiar favourites · weekly",
  "Daily Jams": "A fresh daily mix",
};

export async function getDiscoveryPlaylists(): Promise<DiscoveryPlaylist[]> {
  if (!isDiscoveryConfigured) return [];
  return cached("discovery-playlists", ["discovery"], async () => {
    const metas = await getRecommendationPlaylists();
    return metas.map((m) => ({
      mbid: m.mbid,
      kind: m.kind,
      title: m.title,
      subtitle: SUBTITLES[m.kind] ?? "Recommended for you",
      available: true,
    }));
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function enrich(raw: RawTrack[], libKeys: Set<string>): Promise<DiscoveryTrack[]> {
  return mapLimit(raw, 5, async (t) => {
    const dz = await lookupTrack(t.artist, t.title);
    return enrichTrack(t, dz, libKeys);
  });
}

export async function getDiscoveryTracks(mbid: string): Promise<DiscoveryTrack[]> {
  if (!isDiscoveryConfigured) return [];
  return cached(`discovery-tracks:${mbid}`, ["discovery"], async () => {
    const [lbTracks, libKeys] = await Promise.all([getPlaylistTracks(mbid), getLibraryKeys()]);
    return enrich(
      lbTracks.map((t) => ({
        artist: t.artist,
        title: t.title,
        id: t.recordingMbid,
        durationSecs: t.durationSecs,
      })),
      libKeys,
    );
  });
}

export async function getRecommendedTracks(fresh = false): Promise<DiscoveryTrack[]> {
  if (!isLastfmConfigured) return [];
  const load = async () => {
    const [pool, libKeys] = await Promise.all([getTopTracks(20), getLibraryKeys()]);
    if (pool.length === 0) return [];
    const seeds = (fresh ? shuffle(pool) : pool).slice(0, 8);
    const top = await dedupeTrackCandidates(
      seeds,
      (s) => getSimilarTracks(s.artist, s.title, 10).catch(() => []),
      libKeys,
    );
    return enrich(top, libKeys);
  };
  return fresh ? load() : cached("discovery-recommended", ["discovery"], load);
}

export async function getArtistRecos(fresh = false): Promise<DiscoveryArtist[]> {
  if (!isLastfmConfigured) return [];
  const load = async () => {
    const [pool, owned] = await Promise.all([getTopArtists(15), getLibraryArtistKeys()]);
    const seeds = (fresh ? shuffle(pool) : pool).slice(0, 6);
    return await dedupeArtistCandidates(
      seeds,
      (s) => getSimilarArtists(s, 8).catch(() => []),
      owned,
    );
  };
  return fresh ? load() : cached("discovery-artists", ["discovery"], load);
}

export async function getArtistTracks(name: string): Promise<DiscoveryTrack[]> {
  if (!isLastfmConfigured) return [];
  return cached(`discovery-artist:${name.toLowerCase()}`, ["discovery"], async () => {
    const [raw, libKeys] = await Promise.all([getArtistTopTracks(name, 12), getLibraryKeys()]);
    return enrich(
      raw.map((t) => ({ artist: t.artist, title: t.title })),
      libKeys,
    );
  });
}
