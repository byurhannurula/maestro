import { normArtist, trackKey } from "@/lib/navidrome/dedupe";
import type { DiscoveryArtist } from "@/lib/types";

interface SeedTrack {
  artist: string;
  title: string;
}

interface SimilarTrack {
  artist: string;
  title: string;
  match?: number;
}

interface SimilarArtist {
  name: string;
  match: number;
}

export interface TrackCandidate {
  artist: string;
  title: string;
  match?: number;
  reason?: string;
}

export async function dedupeTrackCandidates(
  seeds: SeedTrack[],
  similar: (seed: SeedTrack) => Promise<SimilarTrack[]>,
  libKeys: Set<string>,
): Promise<TrackCandidate[]> {
  const cand = new Map<string, TrackCandidate>();
  for (const seed of seeds) {
    const sims = await similar(seed);
    for (const s of sims) {
      const k = trackKey(s.artist, s.title);
      if (libKeys.has(k)) continue;
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
  return [...cand.values()].sort((a, b) => (b.match ?? 0) - (a.match ?? 0)).slice(0, 18);
}

export async function dedupeArtistCandidates(
  seeds: string[],
  similar: (seed: string) => Promise<SimilarArtist[]>,
  owned: Set<string>,
): Promise<DiscoveryArtist[]> {
  const cand = new Map<string, DiscoveryArtist>();
  const seedKeys = new Set(seeds.map((s) => normArtist(s)));
  for (const seed of seeds) {
    const sims = await similar(seed);
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
}
