import "server-only";
import { env } from "@/lib/env";
import { getJson, trimSlash } from "@/lib/http";

/**
 * Deezer public API — no auth for search. Used to enrich a recommendation with
 * a 30-second preview + cover art, and to confirm the track exists on Deezer
 * (which means deemix can download it — same catalog). Rate limit is ~50 req /
 * 5s per IP, so callers throttle and results are cached.
 *
 * Note: this is the public catalog API (api.deezer.com), NOT the deemix backend
 * (that lives in lib/deemix).
 */

const base = () => trimSlash(env.DEEZER_API_URL);

export interface DeezerMatch {
  preview?: string;
  cover?: string;
  deezerUrl?: string;
  album?: string;
  durationSecs?: number;
}

interface DeezerTrackRaw {
  link?: string;
  preview?: string;
  duration?: number;
  album?: { title?: string; cover_medium?: string; cover?: string };
}

async function searchOne(q: string): Promise<DeezerTrackRaw | null> {
  // Swallow failures to null so the fielded → loose fallback in lookupTrack works.
  const data = await getJson<{ data?: DeezerTrackRaw[] }>(
    `${base()}/search?limit=1&q=${encodeURIComponent(q)}`,
  ).catch(() => null);
  return data && Array.isArray(data.data) && data.data.length ? data.data[0] : null;
}

/** Best-effort Deezer lookup for a track; null when nothing matches. */
export async function lookupTrack(artist: string, title: string): Promise<DeezerMatch | null> {
  const clean = (s: string) => s.replace(/"/g, "").trim();
  try {
    // Fielded query first for precision, then a looser fallback.
    const hit =
      (await searchOne(`artist:"${clean(artist)}" track:"${clean(title)}"`)) ??
      (await searchOne(`${clean(artist)} ${clean(title)}`));
    if (!hit) return null;
    return {
      preview: hit.preview || undefined,
      cover: hit.album?.cover_medium ?? hit.album?.cover ?? undefined,
      deezerUrl: hit.link,
      album: hit.album?.title,
      durationSecs: typeof hit.duration === "number" ? hit.duration : undefined,
    };
  } catch {
    return null;
  }
}
