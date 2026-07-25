import type { PlayerTrack } from "@/components/player-provider";
import type { Song } from "@/lib/types";

export function libraryTrack(song: Song, starred?: boolean): PlayerTrack {
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    src: `/api/stream?id=${encodeURIComponent(song.id)}`,
    coverArt: song.coverArt,
    starred: starred ?? song.starred,
    source: "library",
  };
}

export function previewTrack(
  id: string,
  title: string,
  previewUrl: string,
  artist?: string,
  coverUrl?: string,
): PlayerTrack {
  return {
    id,
    title,
    artist,
    src: `/api/preview?url=${encodeURIComponent(previewUrl)}`,
    coverUrl,
    source: "preview",
  };
}
