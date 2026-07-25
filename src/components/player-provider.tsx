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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useSidebar } from "@/components/sidebar-provider";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A single global audio player for the whole app. One <audio> element lives
 * here; any list row calls `play()`/`toggle()` with a PlayerTrack (and,
 * optionally, the surrounding list as a queue so prev/next and autoplay work).
 * Library tracks stream from Navidrome via /api/stream; discovery/import rows
 * pass a Deezer 30s preview URL. The mini-bar renders only while a track is
 * loaded. Transport, volume, shuffle and repeat live inside this component, so
 * they never widen the context value (which would re-render every list row on
 * each time-update tick).
 */

export interface PlayerTrack {
  /** Stable id, unique across sources (used to tell "is this row playing?"). */
  id: string;
  title: string;
  artist?: string;
  /** Audio URL: /api/stream?id=… for library, or a Deezer preview URL. */
  src: string;
  /** Navidrome coverArt id → /api/cover (library tracks). */
  coverArt?: string;
  /** Absolute cover URL (Deezer previews). */
  coverUrl?: string;
  /** Current favourite state (library tracks only) — drives the bar's heart. */
  starred?: boolean;
  source: "library" | "preview";
}

interface PlayerContextValue {
  current: PlayerTrack | null;
  playing: boolean;
  /** Play a track; pass the surrounding list to enable prev/next + autoplay. */
  play: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  /** Play/pause toggle for a track (starts it, with optional queue, if new). */
  toggle: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  stop: () => void;
  /** True when `id` is the loaded track. */
  isCurrent: (id: string) => boolean;
}

type Repeat = "off" | "all" | "one";

interface Playback {
  queue: PlayerTrack[];
  /** Play order into `queue` — identity when linear, shuffled when shuffle is on. */
  order: number[];
  /** Position within `order`. */
  pos: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}

/** Fisher–Yates over indices, with `first` placed at the front (stays current). */
function shuffledOrder(n: number, first: number): number[] {
  const rest = [];
  for (let i = 0; i < n; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [pb, setPb] = useState<Playback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [starred, setStarred] = useState(false);

  const current = pb ? (pb.queue[pb.order[pb.pos]] ?? null) : null;
  const hasNext = !!pb && (repeat === "all" || pb.pos < pb.order.length - 1);
  const hasPrev = !!pb && (repeat === "all" || pb.pos > 0);

  // Restore persisted volume once.
  useEffect(() => {
    try {
      const v = localStorage.getItem("maestro.volume");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v != null) setVolume(Math.min(1, Math.max(0, Number(v))));
    } catch {
      /* ignore */
    }
  }, []);

  // Apply + persist volume/mute.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : volume;
    try {
      localStorage.setItem("maestro.volume", String(volume));
    } catch {
      /* ignore */
    }
  }, [volume, muted]);

  // Publish the mini-bar's presence as a CSS var so any floating action bar can
  // sit above it (`bottom-[var(--player-bar-offset,1.5rem)]`) without each view
  // having to consume the player context just for layout.
  useEffect(() => {
    const root = document.documentElement;
    if (current) root.style.setProperty("--player-bar-offset", "5.25rem");
    else root.style.removeProperty("--player-bar-offset");
    return () => {
      root.style.removeProperty("--player-bar-offset");
    };
  }, [current]);

  // Load + autoplay whenever the *track identity* changes (not on pause/resume).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !current) return;
    a.src = current.src;
    a.load();
    setTime(0);
    setDuration(0);
    void a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, current?.src]);

  // Reflect the current track's favourite state when it changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStarred(current?.starred ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Favourite the current library track (optimistic; reverts on failure).
  const toggleStar = useCallback(async () => {
    if (!current || current.source !== "library") return;
    const nextVal = !starred;
    setStarred(nextVal);
    try {
      const res = await fetch("/api/star", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [current.id], starred: nextVal }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      setStarred(!nextVal);
      toast.error(`Favourite failed: ${e instanceof Error ? e.message : e}`);
    }
  }, [current, starred]);

  const startQueue = useCallback(
    (track: PlayerTrack, queue: PlayerTrack[] | undefined, shuffleNow: boolean) => {
      const q = queue && queue.length ? queue : [track];
      const start = Math.max(
        0,
        q.findIndex((t) => t.id === track.id),
      );
      const order = shuffleNow ? shuffledOrder(q.length, start) : q.map((_, i) => i);
      const pos = shuffleNow ? 0 : start;
      setPb({ queue: q, order, pos });
    },
    [],
  );

  const play = useCallback(
    (track: PlayerTrack, queue?: PlayerTrack[]) => startQueue(track, queue, shuffle),
    [startQueue, shuffle],
  );

  const toggle = useCallback(
    (track: PlayerTrack, queue?: PlayerTrack[]) => {
      const a = audioRef.current;
      if (a && current?.id === track.id) {
        if (a.paused) void a.play().catch(() => setPlaying(false));
        else a.pause();
      } else {
        startQueue(track, queue, shuffle);
      }
    },
    [current, startQueue, shuffle],
  );

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setPb(null);
    setPlaying(false);
    setTime(0);
    setDuration(0);
  }, []);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = t;
    setTime(t);
  }, []);

  const next = useCallback(() => {
    setPb((prev) => {
      if (!prev) return prev;
      if (prev.pos < prev.order.length - 1) return { ...prev, pos: prev.pos + 1 };
      if (repeat === "all") return { ...prev, pos: 0 };
      return prev;
    });
  }, [repeat]);

  const prev = useCallback(() => {
    const a = audioRef.current;
    // Spotify-style: restart the track if we're more than 3s in.
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    setPb((p) => {
      if (!p) return p;
      if (p.pos > 0) return { ...p, pos: p.pos - 1 };
      if (repeat === "all") return { ...p, pos: p.order.length - 1 };
      // At the very start with no wrap — just restart.
      if (a) a.currentTime = 0;
      return p;
    });
  }, [repeat]);

  const onEnded = useCallback(() => {
    const a = audioRef.current;
    if (repeat === "one" && a) {
      a.currentTime = 0;
      void a.play().catch(() => setPlaying(false));
      return;
    }
    if (hasNext) next();
    else setPlaying(false);
  }, [repeat, hasNext, next]);

  // Re-shuffle (or restore linear order) in place, keeping the current track.
  const toggleShuffle = useCallback(() => {
    setShuffle((on) => {
      const nextOn = !on;
      setPb((p) => {
        if (!p) return p;
        const cur = p.order[p.pos];
        const order = nextOn ? shuffledOrder(p.queue.length, cur) : p.queue.map((_, i) => i);
        return { ...p, order, pos: nextOn ? 0 : cur };
      });
      return nextOn;
    });
  }, []);

  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    [],
  );

  const isCurrent = useCallback((id: string) => current?.id === id, [current]);

  const value = useMemo<PlayerContextValue>(
    () => ({ current, playing, play, toggle, stop, isCurrent }),
    [current, playing, play, toggle, stop, isCurrent],
  );

  const coverSrc = current
    ? current.source === "library" && current.coverArt
      ? `/api/cover?id=${encodeURIComponent(current.coverArt)}&size=96`
      : current.coverUrl
    : undefined;

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <PlayerContext.Provider value={value}>
      {children}

      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          setDuration(Number.isFinite(d) ? d : 0);
        }}
        className="hidden"
      />

      {current && (
        <div
          className={cn(
            "fixed bottom-0 right-0 left-0 z-40 border-t border-border bg-card/95 backdrop-blur transition-[left] duration-200 ease-in-out supports-backdrop-filter:bg-card/80",
            // Sit beside the sidebar when it's open (desktop only); span full
            // width when collapsed, and always on mobile (sidebar is off-canvas).
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
                  onClick={toggleStar}
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

            {/* ── Center: transport + seek (exactly centered) ────────── */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleShuffle}
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
                  onClick={prev}
                  disabled={!hasPrev}
                  aria-label="Previous"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <SkipBack className="size-4 fill-current" />
                </button>
                <button
                  onClick={() => current && toggle(current)}
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
                  onClick={next}
                  disabled={!hasNext}
                  aria-label="Next"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  <SkipForward className="size-4 fill-current" />
                </button>
                <button
                  onClick={cycleRepeat}
                  aria-label={`Repeat: ${repeat}`}
                  title={`Repeat: ${repeat}`}
                  className={cn(
                    "hidden rounded-md p-1.5 transition-colors hover:text-foreground sm:block",
                    repeat === "off" ? "text-muted-foreground" : "text-primary",
                  )}
                >
                  {repeat === "one" ? (
                    <Repeat1 className="size-4" />
                  ) : (
                    <Repeat className="size-4" />
                  )}
                </button>
              </div>

              <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
                {formatDuration(Math.floor(time))}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(time, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
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
                  onClick={() => setMuted((m) => !m)}
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
                    setVolume(Number(e.target.value));
                    setMuted(false);
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
                onClick={stop}
                aria-label="Close player"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
}
