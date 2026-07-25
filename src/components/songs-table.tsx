"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Heart,
  ListPlus,
  ListX,
  Loader2,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlayer, type PlayerTrack } from "@/components/player-provider";
import { ScrollingText } from "@/components/scrolling-text";
import { useShortcut, useShortcutHint } from "@/components/shortcuts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useInfiniteSongs } from "@/hooks/use-infinite-songs";
import { usePersistent } from "@/hooks/use-persistent";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Playlist, Song, SongSortKey, SongsResult } from "@/lib/types";

const PAGE_SIZES = [25, 50, 100, 200, 500];
const ROW_HEIGHT = 53;

// Cleanup "dead weight" age cutoffs: hide never-played tracks added more
// recently than this, so fresh imports aren't mistaken for junk.
const STALE_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "Any age" },
  { days: 7, label: "Over 7 days" },
  { days: 30, label: "Over 30 days" },
  { days: 90, label: "Over 90 days" },
  { days: 180, label: "Over 6 months" },
  { days: 365, label: "Over 1 year" },
];
const staleLabel = (days: number) =>
  STALE_OPTIONS.find((o) => o.days === days)?.label ?? `Over ${days} days`;

type ColId = "title" | "artist" | "album" | "playCount" | "added" | "lastPlayed" | "duration";

interface Col {
  id: ColId;
  sortKey: SongSortKey | null;
  label: string;
  align?: "right";
  /** Fixed width in px (table-fixed keeps columns stable while virtualized).
   *  Omit to let the column flex and absorb slack (keeps the layout gap-free). */
  width?: number;
}

const COLUMNS: Col[] = [
  { id: "title", sortKey: "title", label: "Title", width: 240 },
  { id: "artist", sortKey: "artist", label: "Artist", width: 220 },
  { id: "album", sortKey: "album", label: "Album", width: 200 },
  { id: "playCount", sortKey: "playCount", label: "Plays", align: "right", width: 76 },
  { id: "added", sortKey: "createdAt", label: "Added", align: "right", width: 116 },
  { id: "lastPlayed", sortKey: "lastPlayed", label: "Last played", align: "right", width: 128 },
  { id: "duration", sortKey: null, label: "Time", align: "right", width: 66 },
];

const TEXT_COLS = new Set<ColId>(["title", "artist", "album"]);
const TOGGLEABLE: ColId[] = ["artist", "album", "playCount", "added", "lastPlayed", "duration"];
const DEFAULT_DESC: SongSortKey[] = ["playCount", "createdAt", "lastPlayed"];

// CSS-grid tracks: title widest, artist/album medium & equal, stats compact.
// minmax(0, …fr) lets the flexible columns shrink so text truncates cleanly.
const GRID: Record<ColId, string> = {
  title: "minmax(0, 3fr)",
  artist: "minmax(0, 1.6fr)",
  album: "minmax(0, 1.6fr)",
  playCount: "72px",
  added: "116px",
  lastPlayed: "128px",
  duration: "64px",
};

function textOf(col: Col, s: Song): string {
  if (col.id === "title") return s.title;
  if (col.id === "artist") return s.artist;
  if (col.id === "album") return s.album;
  return "";
}

// Progressive column hiding by viewport width — narrower screens shed the
// least-essential columns first (title always stays). Applied on top of the
// user's manual View toggles.
const RESPONSIVE_HIDE: { maxWidth: number; col: ColId }[] = [
  { maxWidth: 1280, col: "album" },
  { maxWidth: 1120, col: "added" },
  { maxWidth: 960, col: "lastPlayed" },
  { maxWidth: 760, col: "playCount" },
  { maxWidth: 520, col: "artist" },
];

/** Map a library Song to a queue entry that streams from Navidrome. */
function toPlayerTrack(s: Song, starred?: boolean): PlayerTrack {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    src: `/api/stream?id=${encodeURIComponent(s.id)}`,
    coverArt: s.coverArt,
    starred: starred ?? s.starred,
    source: "library",
  };
}

/** Cover art that doubles as a play/pause button, streaming the song from Navidrome. */
function Cover({ song, queue, size = 44 }: { song: Song; queue: PlayerTrack[]; size?: number }) {
  const [failed, setFailed] = useState(false);
  const player = usePlayer();
  const active = player.isCurrent(song.id);
  const playing = active && player.playing;

  return (
    <button
      onClick={() => player.toggle(toPlayerTrack(song), queue)}
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

export function SongsTable({
  initial,
  now,
  playlists = [],
  defaultSort = "title",
  defaultOrder = "ASC",
  defaultPageSize = 25,
  defaultStaleDays = 30,
  playlistId,
  unplayedOnly = false,
}: {
  initial: SongsResult;
  now: number;
  playlists?: Playlist[];
  defaultSort?: SongSortKey;
  defaultOrder?: "ASC" | "DESC";
  defaultPageSize?: number;
  defaultStaleDays?: number;
  playlistId?: string;
  unplayedOnly?: boolean;
}) {
  const router = useRouter();

  // Query state (owned here; drives the data hook).
  const [sort, setSort] = useState<SongSortKey>(defaultSort);
  const [order, setOrder] = useState<"ASC" | "DESC">(defaultOrder);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchHint = useShortcutHint("focus-search");

  // Cmd/Ctrl+F focuses the search box (overrides browser find — intentional for
  // an in-app data search). Works even from another field.
  useShortcut({
    id: "focus-search",
    combo: "mod+f",
    label: "Focus search",
    group: "View",
    allowInInput: true,
    run: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
  });
  const [hiddenCols, setHiddenCols] = usePersistent<ColId[]>("maestro.hiddenCols.v2", []);
  const [pageSize, setPageSize] = usePersistent<number>("maestro.pageSize", defaultPageSize);
  const [staleDays, setStaleDays] = usePersistent<number>("maestro.staleDays", defaultStaleDays);
  // Fold artist under the title in one column, Spotify/Explo-style (album keeps
  // its own column). Default on.
  const [combineArtist, setCombineArtist] = usePersistent<boolean>(
    "maestro.combineArtist.v2",
    true,
  );

  const { songs, setSongs, total, source, loading, reachedEnd, loadMore, reload } =
    useInfiniteSongs(initial, {
      sort,
      order,
      search,
      playlistId,
      favoritesOnly,
      unplayedOnly,
      staleDays,
      pageSize,
    });

  // Interaction state.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stars, setStars] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeState, setRemoveState] = useState<{ indices: number[]; count: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shiftDown = useRef(false);
  const lastIndex = useRef<number | null>(null);

  // Columns forced off by the current viewport width (independent of the user's
  // View menu, which still reflects their explicit preference).
  const vw = useViewportWidth();
  const autoHidden = useMemo(() => {
    const h = new Set<ColId>();
    if (vw == null) return h; // SSR / first paint: render the full desktop layout
    for (const r of RESPONSIVE_HIDE) if (vw < r.maxWidth) h.add(r.col);
    return h;
  }, [vw]);

  const userShows = (id: ColId) => !hiddenCols.includes(id);
  const show = (id: ColId) =>
    userShows(id) && !autoHidden.has(id) && !(combineArtist && id === "artist");
  const visibleCols = COLUMNS.filter((c) => show(c.id));
  // checkbox + cover + data columns + actions.
  const gridTemplateColumns = ["44px", "56px", ...visibleCols.map((c) => GRID[c.id]), "88px"].join(
    " ",
  );

  // Fold artist under the title when the Artist column is dropped by the combine
  // toggle or a narrow viewport (never when the user hid it deliberately). Album
  // keeps its own column, only riding along in the subline when the viewport
  // auto-drops it.
  const artistInline = combineArtist || autoHidden.has("artist");
  const albumInSub = autoHidden.has("album");
  const rowHeight = artistInline ? 62 : ROW_HEIGHT;
  const subText = (s: Song) => (albumInSub && s.album ? `${s.artist} — ${s.album}` : s.artist);

  // The whole loaded list becomes the player queue (prev/next + autoplay walk it).
  const playerQueue = useMemo(
    () => songs.map((s) => toPlayerTrack(s, stars[s.id] ?? s.starred)),
    [songs, stars],
  );

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Clear selection whenever the query changes.
  useEffect(() => {
    setSelected(new Set());
    lastIndex.current = null;
  }, [sort, order, search, playlistId, favoritesOnly, unplayedOnly, staleDays, pageSize]);

  // Track Shift for range selection.
  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftDown.current = true;
    };
    const u = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftDown.current = false;
    };
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => {
      window.removeEventListener("keydown", d);
      window.removeEventListener("keyup", u);
    };
  }, []);

  // Virtualize rows so only what's on screen is in the DOM.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  // Re-measure when the row height changes (combine toggled / breakpoint crossed).
  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  // (No auto-fill on mount — the initial page is exactly DEFAULT_PAGE_SIZE.
  // Further pages load only when the user scrolls near the bottom; see onScroll.)

  function toggleSort(key: SongSortKey) {
    if (sort === key) setOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
    else {
      setSort(key);
      setOrder(DEFAULT_DESC.includes(key) ? "DESC" : "ASC");
    }
  }

  function selectRow(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftDown.current && lastIndex.current !== null) {
        const [a, b] =
          lastIndex.current < index ? [lastIndex.current, index] : [index, lastIndex.current];
        for (let i = a; i <= b; i++) next.add(songs[i].id);
      } else {
        const id = songs[index].id;
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    lastIndex.current = index;
  }

  function toggleColumn(id: ColId) {
    setHiddenCols((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function persistStar(ids: string[], starred: boolean) {
    const res = await fetch("/api/star", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, starred }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  function toggleHeart(s: Song) {
    const current = stars[s.id] ?? s.starred;
    const next = !current;
    setStars((prev) => ({ ...prev, [s.id]: next }));
    persistStar([s.id], next).catch((e) => {
      setStars((prev) => ({ ...prev, [s.id]: current }));
      toast.error(`Favourite failed: ${e instanceof Error ? e.message : e}`);
    });
  }

  async function bulkFavorite() {
    const ids = [...selected];
    setStars((prev) => {
      const n = { ...prev };
      ids.forEach((id) => (n[id] = true));
      return n;
    });
    try {
      await persistStar(ids, true);
      toast.success(`Favourited ${ids.length}`);
    } catch (e) {
      toast.error(`Favourite failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function addSelectedToPlaylist(id: string, name: string) {
    const songIds = [...selected];
    try {
      const res = await fetch("/api/playlist-add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playlistId: id, songIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Added ${songIds.length} to "${name}"`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(`Add failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function createPlaylistAndAdd() {
    const name = window.prompt("New playlist name")?.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { playlists: Playlist[] };
      const created = data.playlists.find((p) => p.name === name);
      if (created) await addSelectedToPlaylist(created.id, name);
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function removeFromPlaylist(indices: number[]) {
    if (!playlistId || indices.length === 0) return;
    try {
      const res = await fetch("/api/playlist-remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playlistId, indices }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Removed ${indices.length} from playlist`);
      setSelected(new Set());
      router.refresh();
      reload();
    } catch (e) {
      toast.error(`Remove failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  function bulkRemoveFromPlaylist() {
    const indices = songs
      .filter((s) => selected.has(s.id))
      .map((s) => s.playlistIndex)
      .filter((n): n is number => n != null);
    if (indices.length > 0) setRemoveState({ indices, count: indices.length });
  }

  async function confirmRemove() {
    if (!removeState) return;
    setRemoving(true);
    try {
      await removeFromPlaylist(removeState.indices);
      setRemoveState(null);
    } finally {
      setRemoving(false);
    }
  }

  async function confirmDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      // Delete by id: the server resolves the real physical path from the Native
      // API (the Subsonic path shown for playlist/search rows is tag-derived).
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const failedNote = data.failed ? `, ${data.failed} failed` : "";
      toast.success(`Moved ${data.moved} to trash${failedNote}`);
      // Drop only the rows the server actually moved — leave failed ones visible.
      const okIds = new Set<string>(
        (data.results as Array<{ id?: string; ok?: boolean }> | undefined)
          ?.filter((r) => r.ok && r.id)
          .map((r) => r.id as string) ?? [],
      );
      setSongs((prev) => prev.filter((s) => !okIds.has(s.id)));
      setSelected(new Set());
      setDeleteOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = songs.length > 0 && selected.size === songs.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedSongs = songs.filter((s) => selected.has(s.id));

  function cellContent(col: Col, s: Song) {
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
          <span className="tabular-nums text-muted-foreground">
            {formatDuration(s.durationSecs)}
          </span>
        );
    }
  }

  function renderRow(s: Song, index: number, offset: number) {
    const isSel = selected.has(s.id);
    const on = stars[s.id] ?? s.starred;
    return (
      <div
        key={`${s.id}-${index}`}
        data-selected={isSel}
        className="group absolute inset-x-0 top-0 grid items-center border-b border-border/50 text-sm hover:bg-muted/40 data-[selected=true]:bg-primary/10"
        style={{ gridTemplateColumns, height: rowHeight, transform: `translateY(${offset}px)` }}
      >
        <div className="pl-6">
          <Checkbox
            checked={isSel}
            onCheckedChange={() => selectRow(index)}
            aria-label="Select row"
          />
        </div>
        <div className="flex justify-center">
          <Cover song={s} queue={playerQueue} />
        </div>
        {visibleCols.map((col) =>
          col.id === "title" && artistInline ? (
            <div key="title" className="min-w-0 px-3">
              <ScrollingText text={s.title} textClassName="font-medium text-foreground" />
              <div className="truncate text-xs text-muted-foreground">{subText(s)}</div>
            </div>
          ) : (
            <div key={col.id} className={cn("min-w-0 px-3", col.align === "right" && "text-right")}>
              {TEXT_COLS.has(col.id) ? (
                <ScrollingText
                  text={textOf(col, s)}
                  textClassName={
                    col.id === "title" ? "font-medium text-foreground" : "text-muted-foreground"
                  }
                />
              ) : (
                cellContent(col, s)
              )}
            </div>
          ),
        )}
        <div className="flex items-center justify-end gap-2 pr-6">
          <button aria-label={on ? "Unfavorite" : "Favorite"} onClick={() => toggleHeart(s)}>
            <Heart
              className={cn(
                "size-4 transition-colors",
                on ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            />
          </button>
          {playlistId && s.playlistIndex != null && (
            <button
              aria-label="Remove from playlist"
              title="Remove from playlist"
              onClick={() => setRemoveState({ indices: [s.playlistIndex!], count: 1 })}
              className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:gap-3 sm:px-6">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, artist, album…"
            className="px-9"
          />
          {!searchInput && searchHint && (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
              {searchHint}
            </kbd>
          )}
        </div>

        <Button
          variant={favoritesOnly ? "default" : "outline"}
          className="h-9"
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <Heart className={cn("size-4", favoritesOnly && "fill-current")} />
          Favourites
        </Button>

        {unplayedOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
              <CalendarClock className="size-4" />
              {staleLabel(staleDays)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuRadioGroup
                value={String(staleDays)}
                onValueChange={(v) => setStaleDays(Number(v))}
              >
                <DropdownMenuLabel>Added before</DropdownMenuLabel>
                {STALE_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.days} value={String(o.days)}>
                    {o.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
            <SlidersHorizontal className="size-4" />
            View
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              {COLUMNS.filter((c) => TOGGLEABLE.includes(c.id)).map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={userShows(c.id)}
                  disabled={c.id === "artist" && combineArtist}
                  onCheckedChange={() => toggleColumn(c.id)}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Layout</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={combineArtist}
                onCheckedChange={() => setCombineArtist((v) => !v)}
              >
                Combine artist
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
              {PAGE_SIZES.map((n) => (
                <DropdownMenuRadioItem key={n} value={String(n)}>
                  {n}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {source === "sample" && <span className="text-amber-400">sample</span>}
          {unplayedOnly ? (
            <>
              {songs.length.toLocaleString()} never-played{reachedEnd ? "" : "+"}
            </>
          ) : (
            <>
              showing {songs.length.toLocaleString()} of {total.toLocaleString()}
            </>
          )}
        </div>
      </div>

      {/* Header — kept outside the scroll area so virtualizer offsets stay simple */}
      <div
        className="grid items-center border-b border-border bg-background text-xs"
        style={{ gridTemplateColumns, height: 41 }}
      >
        <div className="pl-6">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onCheckedChange={() =>
              setSelected(allSelected ? new Set() : new Set(songs.map((s) => s.id)))
            }
            aria-label="Select all loaded"
          />
        </div>
        <div />
        {visibleCols.map((col) => {
          const active = col.sortKey !== null && sort === col.sortKey;
          return (
            <div
              key={col.id}
              className={cn("min-w-0 px-3", col.align === "right" && "flex justify-end")}
            >
              {col.sortKey === null || unplayedOnly ? (
                <span className="font-medium text-muted-foreground">{col.label}</span>
              ) : (
                <button
                  onClick={() => toggleSort(col.sortKey!)}
                  className={cn(
                    "flex items-center gap-1 font-medium hover:text-foreground",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {col.label}
                  {active &&
                    (order === "ASC" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    ))}
                </button>
              )}
            </div>
          );
        })}
        <div />
      </div>

      {/* Scroll area — virtualized rows only */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setShowTop(el.scrollTop > 600);
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
        }}
        className="flex-1 overflow-auto"
      >
        <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
          {virtualItems.map((vi) => renderRow(songs[vi.index], vi.index, vi.start))}
        </div>

        <div className="px-6 py-4 text-center text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : reachedEnd
              ? songs.length === 0
                ? "No songs match."
                : "End of list."
              : ""}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-(--player-bar-offset,1.5rem) flex justify-center px-3 transition-[bottom] duration-200">
          <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-2 shadow-lg sm:gap-2 sm:px-3">
            <span className="whitespace-nowrap px-1 text-sm font-medium tabular-nums sm:px-2">
              {selected.size}
              <span className="hidden sm:inline"> selected</span>
            </span>
            <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Add to playlist"
                className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-sm hover:bg-accent hover:text-accent-foreground sm:px-3"
              >
                <ListPlus className="size-4" />{" "}
                <span className="hidden sm:inline">Add to playlist</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="center"
                className="max-h-72 w-56 overflow-y-auto"
              >
                <DropdownMenuItem onClick={createPlaylistAndAdd}>
                  <Plus className="size-4" /> New playlist…
                </DropdownMenuItem>
                {playlists.length > 0 && <DropdownMenuSeparator />}
                {playlists.map((pl) => (
                  <DropdownMenuItem
                    key={pl.id}
                    onClick={() => addSelectedToPlaylist(pl.id, pl.name)}
                  >
                    <span className="truncate">{pl.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="sm"
              variant="ghost"
              onClick={bulkFavorite}
              aria-label="Favourite"
              className="whitespace-nowrap"
            >
              <Heart className="size-4" /> <span className="hidden sm:inline">Favourite</span>
            </Button>
            {playlistId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={bulkRemoveFromPlaylist}
                aria-label="Remove from playlist"
                className="whitespace-nowrap"
              >
                <ListX className="size-4" />{" "}
                <span className="hidden sm:inline">Remove from playlist</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete"
              className="whitespace-nowrap text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> <span className="hidden sm:inline">Delete</span>
            </Button>
            <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="size-4 sm:hidden" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </div>
        </div>
      )}

      {showTop && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="absolute right-6 bottom-(--player-bar-offset,1.5rem) z-20 flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-[bottom,background-color,color] duration-200 hover:bg-muted hover:text-foreground"
        >
          <ArrowUp className="size-4" />
        </button>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedSongs.length} track(s) to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Files move to the <code className="rounded bg-muted px-1">./trash</code> folder
              (recoverable), then Navidrome is rescanned to drop the missing rows. Nothing is
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
            {selectedSongs.map((s) => (
              <div key={s.id} className="truncate py-0.5" title={`${s.artist} — ${s.title}`}>
                {s.artist} — {s.title}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Moving…" : "Move to trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeState} onOpenChange={(o) => !o && setRemoveState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeState?.count ?? 0} track{removeState?.count === 1 ? "" : "s"} from this
              playlist?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The track{removeState?.count === 1 ? "" : "s"} stay in your library and the files
              aren&apos;t touched — only the playlist entry is removed. You can add them back
              anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
              disabled={removing}
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
