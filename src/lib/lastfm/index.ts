import "server-only";
import { env } from "@/lib/env";
import { getJson } from "@/lib/http";

/**
 * Last.fm read client (API key only, no auth). Powers Discovery's "recommended
 * tracks" (track.getSimilar) and "artists to explore" (artist.getSimilar),
 * seeded from the library's most-played artists/tracks. The old turnkey
 * recommendation endpoint was removed in 2016, so we build recs from similarity.
 */

export interface LfArtist {
  name: string;
  /** 0–1 similarity. */
  match: number;
}

export interface LfTrack {
  artist: string;
  title: string;
  match?: number;
}

/** Last.fm returns a single result as an object, many as an array. */
export function asArray<T>(x: unknown): T[] {
  if (Array.isArray(x)) return x as T[];
  return x ? [x as T] : [];
}

function call(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(env.LASTFM_API_URL);
  url.searchParams.set("api_key", env.LASTFM_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return getJson<Record<string, unknown>>(url);
}

export async function getSimilarArtists(name: string, limit = 8): Promise<LfArtist[]> {
  const data = await call({ method: "artist.getSimilar", artist: name, limit: String(limit) });
  const root = data.similarartists as { artist?: unknown } | undefined;
  return asArray<{ name?: unknown; match?: unknown }>(root?.artist)
    .map((a) => ({ name: String(a.name ?? ""), match: Number(a.match) || 0 }))
    .filter((a) => a.name);
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 10,
): Promise<LfTrack[]> {
  const data = await call({ method: "track.getSimilar", artist, track, limit: String(limit) });
  const root = data.similartracks as { track?: unknown } | undefined;
  return asArray<{ name?: unknown; artist?: { name?: unknown }; match?: unknown }>(root?.track)
    .map((t) => ({
      artist: String(t.artist?.name ?? ""),
      title: String(t.name ?? ""),
      match: Number(t.match) || 0,
    }))
    .filter((t) => t.artist && t.title);
}

export async function getArtistTopTracks(name: string, limit = 12): Promise<LfTrack[]> {
  const data = await call({ method: "artist.getTopTracks", artist: name, limit: String(limit) });
  const root = data.toptracks as { track?: unknown } | undefined;
  return asArray<{ name?: unknown; artist?: { name?: unknown } }>(root?.track)
    .map((t) => ({ artist: String(t.artist?.name ?? name), title: String(t.name ?? "") }))
    .filter((t) => t.title);
}
