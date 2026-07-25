"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShortcut, useShortcutHint } from "@/components/shortcuts";
import { BulkActionBar } from "@/components/tables/songs-table-bulk-bar";
import {
  COLUMNS,
  DEFAULT_DESC,
  GRID,
  RESPONSIVE_HIDE,
  ROW_HEIGHT,
} from "@/components/tables/songs-table-columns";
import { TableHeader } from "@/components/tables/songs-table-header";
import { SongRow } from "@/components/tables/songs-table-row";
import { TableToolbar } from "@/components/tables/songs-table-toolbar";
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
import { useCreatePlaylist } from "@/hooks/use-create-playlist";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteSongs } from "@/hooks/use-infinite-songs";
import { usePersistent } from "@/hooks/use-persistent";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import { libraryTrack } from "@/lib/player-track";
import {
  addSelectedToPlaylist as addToPlaylist,
  bulkFavorite,
  bulkRemoveFromPlaylist as bulkRemove,
  confirmDelete as deleteSongs,
  removeFromPlaylist,
} from "@/lib/song-mutations";
import type { ColId } from "@/components/tables/songs-table-columns";
import type { Playlist, SongSortKey, SongsResult } from "@/lib/types";

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

  const [sort, setSort] = useState<SongSortKey>(defaultSort);
  const [order, setOrder] = useState<"ASC" | "DESC">(defaultOrder);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchHint = useShortcutHint("focus-search");

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

  const [stars, setStars] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeState, setRemoveState] = useState<{ indices: number[]; count: number } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { selected, setSelected, selectRow, allSelected, someSelected, selectedSongs } =
    useRowSelection(songs, {
      sort,
      order,
      search,
      playlistId,
      favoritesOnly,
      unplayedOnly,
      staleDays,
      pageSize,
    });

  const vw = useViewportWidth();
  const autoHidden = useMemo(() => {
    const h = new Set<ColId>();
    if (vw == null) return h;
    for (const r of RESPONSIVE_HIDE) if (vw < r.maxWidth) h.add(r.col);
    return h;
  }, [vw]);

  const userShows = (id: ColId) => !hiddenCols.includes(id);
  const show = (id: ColId) =>
    userShows(id) && !autoHidden.has(id) && !(combineArtist && id === "artist");
  const visibleCols = COLUMNS.filter((c) => show(c.id));
  const gridTemplateColumns = ["44px", "56px", ...visibleCols.map((c) => GRID[c.id]), "88px"].join(
    " ",
  );

  const artistInline = combineArtist || autoHidden.has("artist");
  const albumInSub = autoHidden.has("album");
  const rowHeight = artistInline ? 62 : ROW_HEIGHT;

  const playerQueue = useMemo(
    () => songs.map((s) => libraryTrack(s, stars[s.id] ?? s.starred)),
    [songs, stars],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowHeight, rowVirtualizer]);

  function toggleSort(key: SongSortKey) {
    if (sort === key) setOrder((o) => (o === "ASC" ? "DESC" : "ASC"));
    else {
      setSort(key);
      setOrder(DEFAULT_DESC.includes(key) ? "DESC" : "ASC");
    }
  }

  function toggleColumn(id: ColId) {
    setHiddenCols((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const createPlaylist = useCreatePlaylist();

  async function createPlaylistAndAdd() {
    const result = await createPlaylist();
    if (result?.id) {
      await addToPlaylist(
        result.id,
        result.name,
        [...selected],
        () => setSelected(new Set()),
        () => router.refresh(),
      );
    }
  }

  function handleBulkFavorite() {
    void bulkFavorite([...selected], setStars);
  }

  function handleBulkRemove() {
    bulkRemove(songs, selected, setRemoveState);
  }

  function handleDelete() {
    void deleteSongs({
      ids: [...selected],
      setDeleting,
      setSongs,
      clearSelected: () => setSelected(new Set()),
      closeDeleteDialog: () => setDeleteOpen(false),
      routerRefresh: () => router.refresh(),
    });
  }

  async function confirmRemove() {
    if (!removeState) return;
    setRemoving(true);
    try {
      await removeFromPlaylist(
        removeState.indices,
        playlistId!,
        () => setSelected(new Set()),
        () => router.refresh(),
        reload,
      );
      setRemoveState(null);
    } finally {
      setRemoving(false);
    }
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setShowTop(el.scrollTop > 600);
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) loadMore();
  }

  function footerText() {
    if (loading) return "Loading…";
    if (!reachedEnd) return "";
    return songs.length === 0 ? "No songs match." : "End of list.";
  }

  return (
    <div className="relative flex h-full flex-col">
      <TableToolbar
        searchRef={searchRef}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        searchHint={searchHint}
        favoritesOnly={favoritesOnly}
        onToggleFavorites={() => setFavoritesOnly((v) => !v)}
        unplayedOnly={unplayedOnly}
        staleDays={staleDays}
        onStaleDaysChange={setStaleDays}
        hiddenCols={hiddenCols}
        onToggleColumn={toggleColumn}
        combineArtist={combineArtist}
        onToggleCombineArtist={() => setCombineArtist((v) => !v)}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        loading={loading}
        source={source}
        songCount={songs.length}
        total={total}
        reachedEnd={reachedEnd}
      />

      <TableHeader
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAll={() => setSelected(allSelected ? new Set() : new Set(songs.map((s) => s.id)))}
        visibleCols={visibleCols}
        gridTemplateColumns={gridTemplateColumns}
        sort={sort}
        order={order}
        unplayedOnly={unplayedOnly}
        onToggleSort={toggleSort}
      />

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto">
        <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
          {virtualItems.map((vi) => (
            <SongRow
              key={`${songs[vi.index].id}-${vi.index}`}
              song={songs[vi.index]}
              index={vi.index}
              offset={vi.start}
              isSelected={selected.has(songs[vi.index].id)}
              starOn={stars[songs[vi.index].id] ?? songs[vi.index].starred}
              playerQueue={playerQueue}
              visibleCols={visibleCols}
              gridTemplateColumns={gridTemplateColumns}
              rowHeight={rowHeight}
              playlistId={playlistId}
              combineArtist={combineArtist}
              albumInSub={albumInSub}
              now={now}
              onSelect={selectRow}
              onRemoveFromPlaylist={(playlistIndex) =>
                setRemoveState({ indices: [playlistIndex], count: 1 })
              }
              stars={stars}
              setStars={setStars}
            />
          ))}
        </div>

        <div className="px-6 py-4 text-center text-sm text-muted-foreground">{footerText()}</div>
      </div>

      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          playlists={playlists}
          playlistId={playlistId}
          onCreatePlaylist={createPlaylistAndAdd}
          onAddToPlaylist={(id, name) =>
            addToPlaylist(
              id,
              name,
              [...selected],
              () => setSelected(new Set()),
              () => router.refresh(),
            )
          }
          onFavorite={handleBulkFavorite}
          onRemoveFromPlaylist={handleBulkRemove}
          onDelete={() => setDeleteOpen(true)}
          onClear={() => setSelected(new Set())}
        />
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
                handleDelete();
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
