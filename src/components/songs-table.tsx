"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Heart,
  ListPlus,
  ListX,
  Loader2,
  Music,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { DataSource, Playlist, Song, SongSortKey, SongsResult } from "@/lib/types";
import { formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

const PAGE_SIZES = [50, 100, 200, 500];

type ColId = "title" | "artist" | "album" | "playCount" | "added" | "lastPlayed" | "duration";

interface Col {
  id: ColId;
  sortKey: SongSortKey | null;
  label: string;
  align?: "right";
}

const COLUMNS: Col[] = [
  { id: "title", sortKey: "title", label: "Title" },
  { id: "artist", sortKey: "artist", label: "Artist" },
  { id: "album", sortKey: "album", label: "Album" },
  { id: "playCount", sortKey: "playCount", label: "Plays", align: "right" },
  { id: "added", sortKey: "createdAt", label: "Added", align: "right" },
  { id: "lastPlayed", sortKey: "lastPlayed", label: "Last played", align: "right" },
  { id: "duration", sortKey: null, label: "Time", align: "right" },
];

const TOGGLEABLE: ColId[] = ["artist", "album", "playCount", "added", "lastPlayed", "duration"];
const DEFAULT_DESC: SongSortKey[] = ["playCount", "createdAt", "lastPlayed"];

/** State backed by localStorage, so UI prefs survive reloads. */
function usePersistent<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // Hydrate persisted UI prefs once, after mount (avoids SSR mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [key, state]);
  return [state, setState];
}

function Cover({ coverArt, size = 36 }: { coverArt?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="shrink-0 overflow-hidden rounded bg-muted" style={{ width: size, height: size }}>
      {coverArt && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/cover?id=${encodeURIComponent(coverArt)}&size=${size * 2}`}
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
    </div>
  );
}

export function SongsTable({
  initial,
  now,
  playlists = [],
  defaultSort = "title",
  defaultOrder = "ASC",
  playlistId,
  unplayedOnly = false,
}: {
  initial: SongsResult;
  now: number;
  playlists?: Playlist[];
  defaultSort?: SongSortKey;
  defaultOrder?: "ASC" | "DESC";
  playlistId?: string;
  unplayedOnly?: boolean;
}) {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>(initial.songs);
  const [total, setTotal] = useState(initial.total);
  const [source, setSource] = useState<DataSource>(initial.source);
  const [sort, setSort] = useState<SongSortKey>(defaultSort);
  const [order, setOrder] = useState<"ASC" | "DESC">(defaultOrder);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(initial.songs.length >= initial.total);

  // Persisted UI prefs.
  const [hiddenCols, setHiddenCols] = usePersistent<ColId[]>("maestro.hiddenCols", ['album']);
  const [pageSize, setPageSize] = usePersistent<number>("maestro.pageSize", 100);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stars, setStars] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Server offset + seen-ids are tracked separately from the (deduped) display
  // list so paging stays correct even when the library has duplicate rows.
  const serverOffset = useRef(initial.songs.length);
  const seenIds = useRef(new Set(initial.songs.map((s) => s.id)));
  const firstRun = useRef(true);
  const inFlight = useRef(false);
  const shiftDown = useRef(false);
  const lastIndex = useRef<number | null>(null);

  const show = (id: ColId) => !hiddenCols.includes(id);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const start = reset ? 0 : serverOffset.current;
      const params = new URLSearchParams({
        start: String(start),
        end: String(start + pageSize),
        sort,
        order,
      });
      const term = search.trim();
      if (term) params.set("search", term);
      if (playlistId) params.set("playlist", playlistId);
      if (favoritesOnly) params.set("favorites", "1");
      if (unplayedOnly) params.set("unplayed", "1");

      setLoading(true);
      try {
        const res = await fetch(`/api/songs?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SongsResult = await res.json();

        if (reset) {
          seenIds.current = new Set(data.songs.map((s) => s.id));
          setSongs(data.songs);
        } else {
          const fresh = data.songs.filter((s) => !seenIds.current.has(s.id));
          fresh.forEach((s) => seenIds.current.add(s.id));
          setSongs((prev) => [...prev, ...fresh]);
        }
        serverOffset.current = start + data.songs.length;
        setTotal(data.total);
        setSource(data.source);

        // search3 has no exact total → page-size heuristic; else stop at total.
        const heuristicOnly = !!term && !playlistId;
        const done =
          data.songs.length === 0 ||
          (heuristicOnly ? data.songs.length < pageSize : serverOffset.current >= data.total);
        setReachedEnd(done);
      } catch (e) {
        toast.error(`Failed to load songs: ${e instanceof Error ? e.message : e}`);
        setReachedEnd(true);
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [sort, order, search, playlistId, favoritesOnly, pageSize, unplayedOnly],
  );

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Re-query from the top whenever the query changes.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSelected(new Set());
    lastIndex.current = null;
    void fetchPage(true);
  }, [fetchPage]);

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

  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !reachedEnd) void fetchPage(false);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchPage, loading, reachedEnd]);

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
    setStars((prev) => ({ ...prev, [s.id]: next })); // optimistic
    persistStar([s.id], next).catch((e) => {
      setStars((prev) => ({ ...prev, [s.id]: current })); // revert
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
      router.refresh(); // refresh sidebar playlist counts
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
      router.refresh(); // sidebar counts
      void fetchPage(true); // reload playlist with fresh indices
    } catch (e) {
      toast.error(`Remove failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  function bulkRemoveFromPlaylist() {
    const indices = songs
      .filter((s) => selected.has(s.id))
      .map((s) => s.playlistIndex)
      .filter((n): n is number => n != null);
    void removeFromPlaylist(indices);
  }

  async function confirmDelete() {
    const items = songs.filter((s) => selected.has(s.id));
    const paths = items.map((s) => s.path).filter((p): p is string => !!p);
    if (paths.length === 0) {
      toast.error("Selected tracks have no file paths");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      toast.success(
        `Moved ${data.moved} to trash${data.failed ? `, ${data.failed} failed` : ""}`,
      );
      const removed = new Set(items.map((s) => s.id));
      setSongs((prev) => prev.filter((s) => !removed.has(s.id)));
      setTotal((t) => Math.max(0, t - data.moved));
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
  const visibleCols = COLUMNS.filter((c) => show(c.id));
  const colSpan = visibleCols.length + 3;
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

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, artist, album…"
            className="pl-9"
          />
        </div>

        <Button
          variant={favoritesOnly ? "default" : "outline"}
          className="h-9"
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          <Heart className={cn("size-4", favoritesOnly && "fill-current")} />
          Favourites
        </Button>

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
                  checked={show(c.id)}
                  onCheckedChange={() => toggleColumn(c.id)}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
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
            <>{songs.length.toLocaleString()} never-played{reachedEnd ? "" : "+"}</>
          ) : (
            <>showing {songs.length.toLocaleString()} of {total.toLocaleString()}</>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              <th className="border-b border-border px-3 py-2 pl-6">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={() =>
                    setSelected(allSelected ? new Set() : new Set(songs.map((s) => s.id)))
                  }
                  aria-label="Select all loaded"
                />
              </th>
              <th className="border-b border-border px-2 py-2" />
              {visibleCols.map((col) => {
                const active = col.sortKey !== null && sort === col.sortKey;
                return (
                  <th key={col.id} className="border-b border-border px-3 py-2 text-left">
                    {col.sortKey === null || unplayedOnly ? (
                      <span
                        className={cn(
                          "text-xs font-medium text-muted-foreground",
                          col.align === "right" && "block text-right",
                        )}
                      >
                        {col.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => toggleSort(col.sortKey!)}
                        className={cn(
                          "flex items-center gap-1 text-xs font-medium hover:text-foreground",
                          active ? "text-foreground" : "text-muted-foreground",
                          col.align === "right" && "ml-auto justify-end",
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
                  </th>
                );
              })}
              <th className="border-b border-border px-3 py-2 pr-6" />
            </tr>
          </thead>
          <tbody>
            {songs.map((s, index) => {
              const isSel = selected.has(s.id);
              const on = stars[s.id] ?? s.starred;
              return (
                <tr
                  key={`${s.id}-${index}`}
                  data-selected={isSel}
                  className="group hover:bg-muted/40 data-[selected=true]:bg-primary/10"
                >
                  <td className="border-b border-border/50 px-3 py-2 pl-6">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={() => selectRow(index)}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="border-b border-border/50 px-2 py-1.5">
                    <Cover coverArt={s.coverArt} />
                  </td>
                  {visibleCols.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        "border-b border-border/50 px-3 py-2",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {cellContent(col, s)}
                    </td>
                  ))}
                  <td className="border-b border-border/50 px-3 py-2 pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        aria-label={on ? "Unfavorite" : "Favorite"}
                        onClick={() => toggleHeart(s)}
                      >
                        <Heart
                          className={cn(
                            "size-4 transition-colors",
                            on
                              ? "fill-primary text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        />
                      </button>
                      {playlistId && s.playlistIndex != null && (
                        <button
                          aria-label="Remove from playlist"
                          title="Remove from playlist"
                          onClick={() => removeFromPlaylist([s.playlistIndex!])}
                          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr ref={sentinelRef}>
              <td colSpan={colSpan} className="px-6 py-4 text-center text-sm text-muted-foreground">
                {loading
                  ? "Loading…"
                  : reachedEnd
                    ? songs.length === 0
                      ? "No songs match."
                      : "End of list."
                    : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium tabular-nums">{selected.size} selected</span>
            <div className="mx-1 h-5 w-px bg-border" />

            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm hover:bg-accent hover:text-accent-foreground">
                <ListPlus className="size-4" /> Add to playlist
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="max-h-72 w-56 overflow-y-auto">
                <DropdownMenuItem onClick={createPlaylistAndAdd}>
                  <Plus className="size-4" /> New playlist…
                </DropdownMenuItem>
                {playlists.length > 0 && <DropdownMenuSeparator />}
                {playlists.map((pl) => (
                  <DropdownMenuItem key={pl.id} onClick={() => addSelectedToPlaylist(pl.id, pl.name)}>
                    <span className="truncate">{pl.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="ghost" onClick={bulkFavorite}>
              <Heart className="size-4" /> Favourite
            </Button>
            {playlistId && (
              <Button size="sm" variant="ghost" onClick={bulkRemoveFromPlaylist}>
                <ListX className="size-4" /> Remove from playlist
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
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
          <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
            {selectedSongs.map((s) => (
              <div key={s.id} className="truncate py-0.5" title={s.path}>
                {s.path ?? <span className="text-red-400">no path — {s.title}</span>}
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
    </div>
  );
}
