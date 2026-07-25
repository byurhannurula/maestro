"use client";

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
import { PlayerBar } from "@/components/player-bar";
import { useSidebar } from "@/components/sidebar-provider";
import { apiPost } from "@/hooks/use-api";

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

  const BAR_OFFSET_VAR = "--player-bar-offset";
  // Publish the mini-bar's presence as a CSS var so any floating action bar can
  // sit above it (`bottom-[var(--player-bar-offset,1.5rem)]`) without each view
  // having to consume the player context just for layout.
  useEffect(() => {
    const root = document.documentElement;
    if (current) root.style.setProperty(BAR_OFFSET_VAR, "5.25rem");
    else root.style.removeProperty(BAR_OFFSET_VAR);
    return () => {
      root.style.removeProperty(BAR_OFFSET_VAR);
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
      await apiPost("/api/star", { ids: [current.id], starred: nextVal });
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
        <PlayerBar
          current={current}
          playing={playing}
          time={time}
          duration={duration}
          shuffle={shuffle}
          repeat={repeat}
          volume={volume}
          muted={muted}
          starred={starred}
          hasNext={hasNext}
          hasPrev={hasPrev}
          collapsed={collapsed}
          onTogglePlay={() => toggle(current)}
          onStop={stop}
          onNext={next}
          onPrev={prev}
          onSeek={seek}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={cycleRepeat}
          onToggleStar={toggleStar}
          onSetMuted={(m) => setMuted(m)}
          onSetVolume={(v) => setVolume(v)}
        />
      )}
    </PlayerContext.Provider>
  );
}
