"use client";

import { Heart, X } from "lucide-react";
import { ScrollingText } from "@/components/scrolling-text";
import { TEXT_COLS, textOf } from "@/components/tables/songs-table-columns";
import { SongCover } from "@/components/tables/songs-table-cover";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDuration, relativeTime } from "@/lib/format";
import { toggleHeart } from "@/lib/song-mutations";
import { cn } from "@/lib/utils";
import type { PlayerTrack } from "@/components/player-provider";
import type { Col } from "@/components/tables/songs-table-columns";
import type { Song } from "@/lib/types";

export function cellContent(col: Col, s: Song, now: number) {
  switch (col.id) {
    case "title":
      return <span className="font-medium text-foreground">{s.title}</span>;
    case "artist":
      return <span className="text-muted-foreground">{s.artist}</span>;
    case "album":
      return <span className="text-muted-foreground">{s.album}</span>;
    case "playCount":
      return (
        <span className={cn("tabular-nums", s.playCount === 0 && "text-muted-foreground/50")}>
          {s.playCount}
        </span>
      );
    case "added":
      return <span className="text-muted-foreground">{relativeTime(s.createdAt, now)}</span>;
    case "lastPlayed":
      return <span className="text-muted-foreground">{relativeTime(s.lastPlayed, now)}</span>;
    case "duration":
      return (
        <span className="tabular-nums text-muted-foreground">{formatDuration(s.durationSecs)}</span>
      );
  }
}

export function SongRow({
  song,
  index,
  offset,
  isSelected,
  starOn,
  playerQueue,
  visibleCols,
  gridTemplateColumns,
  rowHeight,
  playlistId,
  combineArtist,
  albumInSub,
  now,
  onSelect,
  onRemoveFromPlaylist,
  stars,
  setStars,
}: {
  song: Song;
  index: number;
  offset: number;
  isSelected: boolean;
  starOn: boolean;
  playerQueue: PlayerTrack[];
  visibleCols: Col[];
  gridTemplateColumns: string;
  rowHeight: number;
  playlistId?: string;
  combineArtist: boolean;
  albumInSub: boolean;
  now: number;
  onSelect: (index: number) => void;
  onRemoveFromPlaylist: (playlistIndex: number) => void;
  stars: Record<string, boolean>;
  setStars: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const subText = albumInSub && song.album ? `${song.artist} — ${song.album}` : song.artist;

  return (
    <div
      key={`${song.id}-${index}`}
      data-selected={isSelected}
      className="group absolute inset-x-0 top-0 grid items-center border-b border-border/50 text-sm hover:bg-muted/40 data-[selected=true]:bg-primary/10"
      style={{ gridTemplateColumns, height: rowHeight, transform: `translateY(${offset}px)` }}
    >
      <div className="pl-6">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(index)}
          aria-label="Select row"
        />
      </div>
      <div className="flex justify-center">
        <SongCover song={song} queue={playerQueue} />
      </div>
      {visibleCols.map((col) =>
        col.id === "title" && combineArtist ? (
          <div key="title" className="min-w-0 px-3">
            <ScrollingText text={song.title} textClassName="font-medium text-foreground" />
            <div className="truncate text-xs text-muted-foreground">{subText}</div>
          </div>
        ) : (
          <div key={col.id} className={cn("min-w-0 px-3", col.align === "right" && "text-right")}>
            {TEXT_COLS.has(col.id) ? (
              <ScrollingText
                text={textOf(col, song)}
                textClassName={
                  col.id === "title" ? "font-medium text-foreground" : "text-muted-foreground"
                }
              />
            ) : (
              cellContent(col, song, now)
            )}
          </div>
        ),
      )}
      <div className="flex items-center justify-end gap-2 pr-6">
        <button
          aria-label={starOn ? "Unfavorite" : "Favorite"}
          onClick={() => toggleHeart(song, stars, setStars)}
        >
          <Heart
            className={cn(
              "size-4 transition-colors",
              starOn ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          />
        </button>
        {playlistId && song.playlistIndex != null && (
          <button
            aria-label="Remove from playlist"
            title="Remove from playlist"
            onClick={() => onRemoveFromPlaylist(song.playlistIndex!)}
            className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
