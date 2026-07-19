import "server-only";
import { mapLimit } from "@/lib/concurrency";
import { lookupTrack } from "@/lib/deezer";
import { isDiscoveryConfigured, isLastfmConfigured } from "@/lib/env";
import { getSimilarArtists, getSimilarTracks, getArtistTopTracks } from "@/lib/lastfm";
import { getRecommendationPlaylists, getPlaylistTracks } from "@/lib/listenbrainz";
import { normArtist, trackKey } from "@/lib/navidrome/dedupe";
import {
  getLibraryKeys,
  getLibraryArtistKeys,
  getTopArtists,
  getTopTracks,
} from "@/lib/navidrome/library";
import { cached } from "@/lib/storage/cache";
import type { DiscoveryArtist, DiscoveryPlaylist, DiscoveryTrack } from "@/lib/types";

/**
 * Discovery facade: ListenBrainz recommendation playlists → per-track Deezer
 * enrichment (30s preview, cover, downloadable check) → library-match flag.
 * All reads cached under the "discovery" tag.
 */

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

/** Fisher–Yates shuffle (server runtime; used to vary recommendation seeds). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface RawTrack {
  artist: string;
  title: string;
  id?: string;
  durationSecs?: number;
  match?: number;
  reason?: string;
}

/** Enrich raw {artist,title} rows with Deezer preview/cover + a library flag. */
async function enrich(raw: RawTrack[], libKeys: Set<string>): Promise<DiscoveryTrack[]> {
  return mapLimit(raw, 5, async (t) => {
    const dz = await lookupTrack(t.artist, t.title);
    return {
      id: t.id || trackKey(t.artist, t.title),
      title: t.title,
      artist: t.artist,
      album: dz?.album,
      durationSecs: dz?.durationSecs ?? t.durationSecs,
      preview: dz?.preview,
      cover: dz?.cover,
      deezerUrl: dz?.deezerUrl,
      available: !!dz,
      inLibrary: libKeys.has(trackKey(t.artist, t.title)),
      match: t.match,
      reason: t.reason,
    } satisfies DiscoveryTrack;
  });
}

/** Tracks of a ListenBrainz recommendation playlist. */
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

/** Last.fm "recommended tracks": similar to your most-played tracks. `fresh`
 *  skips the cache and shuffles the seed set for a different batch. */
export async function getRecommendedTracks(fresh = false): Promise<DiscoveryTrack[]> {
  if (!isLastfmConfigured) return [];
  const load = async () => {
    const [pool, libKeys] = await Promise.all([getTopTracks(20), getLibraryKeys()]);
    if (pool.length === 0) return [];
    const seeds = (fresh ? shuffle(pool) : pool).slice(0, 8);
    const cand = new Map<string, RawTrack>();
    for (const seed of seeds) {
      const sims = await getSimilarTracks(seed.artist, seed.title, 10).catch(() => []);
      for (const s of sims) {
        const k = trackKey(s.artist, s.title);
        if (libKeys.has(k)) continue; // already own it
        const prev = cand.get(k);
        if (!prev || (s.match ?? 0) > (prev.match ?? 0)) {
          cand.set(k, {
            artist: s.artist,
            title: s.title,
            match: s.match,
            reason: `Similar to ${seed.title}`,
          });
        }
      }
    }
    const top = [...cand.values()].sort((a, b) => (b.match ?? 0) - (a.match ?? 0)).slice(0, 18);
    return enrich(top, libKeys);
  };
  return fresh ? load() : cached("discovery-recommended", ["discovery"], load);
}

/** Last.fm "artists to explore": similar to your most-played artists. `fresh`
 *  skips the cache and shuffles the seed set for a different batch. */
export async function getArtistRecos(fresh = false): Promise<DiscoveryArtist[]> {
  if (!isLastfmConfigured) return [];
  const load = async () => {
    const [pool, owned] = await Promise.all([getTopArtists(15), getLibraryArtistKeys()]);
    const seeds = (fresh ? shuffle(pool) : pool).slice(0, 6);
    const cand = new Map<string, DiscoveryArtist>();
    const seedKeys = new Set(seeds.map((s) => normArtist(s)));
    for (const seed of seeds) {
      const sims = await getSimilarArtists(seed, 8).catch(() => []);
      for (const s of sims) {
        const key = normArtist(s.name);
        if (seedKeys.has(key) || cand.has(key)) continue;
        cand.set(key, {
          id: key,
          name: s.name,
          basedOn: seed,
          match: s.match,
          inLibrary: owned.has(key),
        });
      }
    }
    return [...cand.values()].sort((a, b) => b.match - a.match).slice(0, 8);
  };
  return fresh ? load() : cached("discovery-artists", ["discovery"], load);
}

/** Deezer-enriched top tracks for one artist (the "Top tracks" expand). */
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
