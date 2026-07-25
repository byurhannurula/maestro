"use client";

import {
  Heart,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PlayerTrack } from "@/components/player-provider";

type Repeat = "off" | "all" | "one";

interface PlayerBarProps {
  current: PlayerTrack;
  playing: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  volume: number;
  muted: boolean;
  starred: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  collapsed: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleStar: () => void;
  onSetMuted: (m: boolean) => void;
  onSetVolume: (v: number) => void;
}

export function PlayerBar({
  current,
  playing,
  time,
  duration,
  shuffle,
  repeat,
  volume,
  muted,
  starred,
  hasNext,
  hasPrev,
  collapsed,
  onTogglePlay,
  onStop,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onToggleStar,
  onSetMuted,
  onSetVolume,
}: PlayerBarProps) {
  const coverSrc =
    current.source === "library" && current.coverArt
      ? `/api/cover?id=${encodeURIComponent(current.coverArt)}&size=96`
      : current.coverUrl;

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 left-0 z-40 border-t border-border bg-card/95 backdrop-blur transition-[left] duration-200 ease-in-out supports-backdrop-filter:bg-card/80",
        !collapsed && "md:left-72",
      )}
    >
      <div className="flex h-17.25 items-center gap-3 px-3 sm:px-4">
        {/* ── Left: cover + title/artist + favourite ─────────────── */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded bg-muted">
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Music className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-medium">{current.title}</div>
            {current.artist && (
              <div className="truncate text-xs text-muted-foreground">{current.artist}</div>
            )}
          </div>

          {current.source === "library" && (
            <button
              onClick={onToggleStar}
              aria-label={starred ? "Unfavourite" : "Favourite"}
              aria-pressed={starred}
              className="shrink-0 transition-colors"
            >
              <Heart
                className={cn(
                  "size-4",
                  starred
                    ? "fill-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              />
            </button>
          )}
        </div>

        {/* ── Center: transport + seek ───────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <TransportControls
            playing={playing}
            shuffle={shuffle}
            repeat={repeat}
            hasNext={hasNext}
            hasPrev={hasPrev}
            onTogglePlay={onTogglePlay}
            onToggleShuffle={onToggleShuffle}
            onCycleRepeat={onCycleRepeat}
            onNext={onNext}
            onPrev={onPrev}
          />

          <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
            {formatDuration(Math.floor(time))}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek"
            className={cn(
              "h-1 w-40 cursor-pointer appearance-none rounded-full bg-muted sm:w-56 md:w-72 lg:w-96",
              "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
              "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
            )}
          />
          <span className="hidden w-10 shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
            {formatDuration(Math.floor(duration))}
          </span>
        </div>

        {/* ── Right: volume + close ──────────────────────────────── */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="hidden shrink-0 items-center gap-1.5 md:flex">
            <button
              onClick={() => onSetMuted(!muted)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <VolIcon className="size-4" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => {
                onSetVolume(Number(e.target.value));
                onSetMuted(false);
              }}
              aria-label="Volume"
              className={cn(
                "h-1 w-20 cursor-pointer appearance-none rounded-full bg-muted",
                "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none",
                "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
                "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full",
                "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary",
              )}
            />
          </div>

          <button
            onClick={onStop}
            aria-label="Close player"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TransportControls({
  playing,
  shuffle,
  repeat,
  hasNext,
  hasPrev,
  onTogglePlay,
  onToggleShuffle,
  onCycleRepeat,
  onNext,
  onPrev,
}: {
  playing: boolean;
  shuffle: boolean;
  repeat: Repeat;
  hasNext: boolean;
  hasPrev: boolean;
  onTogglePlay: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={onToggleShuffle}
        aria-label="Shuffle"
        aria-pressed={shuffle}
        title="Shuffle"
        className={cn(
          "hidden rounded-md p-1.5 transition-colors hover:text-foreground sm:block",
          shuffle ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Shuffle className="size-4" />
      </button>
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <SkipBack className="size-4 fill-current" />
      </button>
      <button
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 translate-x-px fill-current" />
        )}
      </button>
      <button
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
      >
        <SkipForward className="size-4 fill-current" />
      </button>
      <button
        onClick={onCycleRepeat}
        aria-label={`Repeat: ${repeat}`}
        title={`Repeat: ${repeat}`}
        className={cn(
          "hidden rounded-md p-1.5 transition-colors hover:text-foreground sm:block",
          repeat === "off" ? "text-muted-foreground" : "text-primary",
        )}
      >
        {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
      </button>
    </span>
  );
}
