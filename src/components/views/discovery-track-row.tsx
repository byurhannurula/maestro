"use client";

import { Check, Library, Music2, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coverGradient } from "@/lib/cover-gradient";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DiscoveryTrack } from "@/lib/types";

function TrackTag({
  track: t,
  queued,
  onQueue,
}: {
  track: DiscoveryTrack;
  queued: boolean;
  onQueue: () => void;
}) {
  if (t.inLibrary) {
    return (
      <span className="inline-flex w-28 shrink-0 items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground">
        <Library className="size-3" /> In library
      </span>
    );
  }
  if (!t.available) {
    return (
      <span className="inline-flex w-28 shrink-0 items-center justify-end text-[11px] text-muted-foreground/60">
        Not on Deezer
      </span>
    );
  }
  return (
    <Button
      size="xs"
      variant={queued ? "secondary" : "outline"}
      className="w-28 shrink-0"
      onClick={onQueue}
      aria-pressed={queued}
    >
      {queued ? (
        <>
          <Check className="size-3" /> Selected
        </>
      ) : (
        <>
          <Plus className="size-3" /> Download
        </>
      )}
    </Button>
  );
}

export function TrackRow({
  track: t,
  index,
  playing,
  queued,
  onPlay,
  onQueue,
}: {
  track: DiscoveryTrack;
  index: number;
  playing: boolean;
  queued: boolean;
  onPlay: () => void;
  onQueue: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>

      <button
        onClick={onPlay}
        disabled={!t.preview}
        aria-label={t.preview ? (playing ? "Pause preview" : "Play preview") : "No preview"}
        className="relative size-11 shrink-0 overflow-hidden rounded"
      >
        {t.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-linear-to-br",
              coverGradient(t.id),
            )}
          >
            <Music2 className="size-4 text-white/80" />
          </div>
        )}
        {t.preview && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              playing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
              {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            </span>
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{t.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {t.artist}
          {t.album ? ` — ${t.album}` : ""}
        </div>
        {t.reason && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
            {t.match != null && (
              <span className="font-medium text-primary">{Math.round(t.match * 100)}%</span>
            )}
            <span className="truncate">{t.reason}</span>
          </div>
        )}
      </div>

      {t.durationSecs != null && (
        <span className="hidden w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:inline">
          {formatDuration(t.durationSecs)}
        </span>
      )}

      <TrackTag track={t} queued={queued} onQueue={onQueue} />
    </div>
  );
}

export function TrackList({
  tracks,
  rowProps,
}: {
  tracks: DiscoveryTrack[];
  rowProps: (t: DiscoveryTrack) => {
    playing: boolean;
    queued: boolean;
    onPlay: () => void;
    onQueue: () => void;
  };
}) {
  return (
    <div className="flex flex-col">
      {tracks.map((t, i) => (
        <TrackRow key={`${t.id}-${i}`} track={t} index={i} {...rowProps(t)} />
      ))}
    </div>
  );
}
