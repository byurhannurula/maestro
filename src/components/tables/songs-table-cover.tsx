"use client";

import { Music, Pause, Play } from "lucide-react";
import { useState } from "react";
import { usePlayer, type PlayerTrack } from "@/components/player-provider";
import { libraryTrack } from "@/lib/player-track";
import { cn } from "@/lib/utils";
import type { Song } from "@/lib/types";

/** Cover art that doubles as a play/pause button, streaming the song from Navidrome. */
export function SongCover({
  song,
  queue,
  size = 44,
}: {
  song: Song;
  queue: PlayerTrack[];
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const player = usePlayer();
  const active = player.isCurrent(song.id);
  const playing = active && player.playing;

  return (
    <button
      onClick={() => player.toggle(libraryTrack(song), queue)}
      aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
      className="group/cover relative shrink-0 overflow-hidden rounded bg-muted"
      style={{ width: size, height: size }}
    >
      {song.coverArt && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/cover?id=${encodeURIComponent(song.coverArt)}&size=${size * 2}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Music className="size-4 text-muted-foreground" />
        </div>
      )}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity",
          playing ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100",
        )}
      >
        {playing ? (
          <Pause className="size-4 fill-white text-white" />
        ) : (
          <Play className="size-4 fill-white text-white" />
        )}
      </span>
    </button>
  );
}
