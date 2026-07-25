import { trackKey } from "@/lib/navidrome/dedupe";
import type { DeezerMatch } from "@/lib/deezer";
import type { DiscoveryTrack } from "@/lib/types";

export interface RawTrack {
  artist: string;
  title: string;
  id?: string;
  durationSecs?: number;
  match?: number;
  reason?: string;
}

export function enrichTrack(
  raw: RawTrack,
  dz: DeezerMatch | null,
  libKeys: Set<string>,
): DiscoveryTrack {
  return {
    id: raw.id || trackKey(raw.artist, raw.title),
    title: raw.title,
    artist: raw.artist,
    album: dz?.album,
    durationSecs: dz?.durationSecs ?? raw.durationSecs,
    preview: dz?.preview,
    cover: dz?.cover,
    deezerUrl: dz?.deezerUrl,
    available: !!dz,
    inLibrary: libKeys.has(trackKey(raw.artist, raw.title)),
    match: raw.match,
    reason: raw.reason,
  } satisfies DiscoveryTrack;
}
