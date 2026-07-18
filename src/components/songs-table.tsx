"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Heart, ListPlus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Song } from "@/lib/types";
import { formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

function SortHeader({
  label,
  sorted,
  onClick,
  align = "left",
}: {
  label: string;
  sorted: false | "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground",
        align === "right" && "justify-end",
      )}
    >
      {label}
      {sorted === "asc" && <ArrowUp className="size-3" />}
      {sorted === "desc" && <ArrowDown className="size-3" />}
    </button>
  );
}

export function SongsTable({ songs, now }: { songs: Song[]; now: number }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "title", desc: false }]);
  const [filter, setFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [stars, setStars] = useState<Record<string, boolean>>({});

  const columns = useMemo<ColumnDef<Song>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortHeader
            label="Title"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "artist",
        header: ({ column }) => (
          <SortHeader
            label="Artist"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.artist}</span>,
      },
      {
        accessorKey: "album",
        header: () => <span className="text-xs font-medium text-muted-foreground">Album</span>,
        cell: ({ row }) => (
          // Plain text — deliberately NOT a link. Track-first, no album pages.
          <span className="text-muted-foreground">{row.original.album}</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "playCount",
        header: ({ column }) => (
          <SortHeader
            label="Plays"
            align="right"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "block text-right tabular-nums",
              row.original.playCount === 0 ? "text-muted-foreground/50" : "text-foreground",
            )}
          >
            {row.original.playCount}
          </span>
        ),
      },
      {
        id: "added",
        accessorFn: (s) => (s.createdAt ? Date.parse(s.createdAt) : 0),
        header: ({ column }) => (
          <SortHeader
            label="Added"
            align="right"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right text-muted-foreground">
            {relativeTime(row.original.createdAt, now)}
          </span>
        ),
      },
      {
        id: "lastPlayed",
        accessorFn: (s) => (s.lastPlayed ? Date.parse(s.lastPlayed) : 0),
        header: ({ column }) => (
          <SortHeader
            label="Last played"
            align="right"
            sorted={column.getIsSorted()}
            onClick={() => column.toggleSorting()}
          />
        ),
        cell: ({ row }) => (
          <span className="block text-right text-muted-foreground">
            {relativeTime(row.original.lastPlayed, now)}
          </span>
        ),
      },
      {
        id: "duration",
        accessorKey: "durationSecs",
        header: () => <span className="block text-right text-xs font-medium text-muted-foreground">Time</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-muted-foreground">
            {formatDuration(row.original.durationSecs)}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "star",
        header: () => null,
        cell: ({ row }) => {
          const on = stars[row.original.id] ?? row.original.starred;
          return (
            <button
              aria-label={on ? "Unfavorite" : "Favorite"}
              onClick={() => setStars((s) => ({ ...s, [row.original.id]: !on }))}
              className="flex items-center justify-center"
            >
              <Heart
                className={cn(
                  "size-4 transition-colors",
                  on ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              />
            </button>
          );
        },
        enableSorting: false,
      },
    ],
    [now, stars],
  );

  // TanStack Table manages its own memoization; React Compiler safely skips it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: songs,
    columns,
    state: { sorting, globalFilter: filter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row, _col, value) => {
      const s = row.original as Song;
      const q = String(value).toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const selectedCount = table.getSelectedRowModel().rows.length;
  const clearSelection = () => setRowSelection({});

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by title, artist, album…"
            className="pl-9"
          />
        </div>
        <div className="ml-auto text-sm text-muted-foreground tabular-nums">
          {table.getFilteredRowModel().rows.length} songs
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="border-b border-border px-3 py-2 text-left first:pl-6 last:pr-6"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-selected={row.getIsSelected()}
                className="group hover:bg-muted/40 data-[selected=true]:bg-primary/5"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="border-b border-border/50 px-3 py-2 first:pl-6 last:pr-6"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium tabular-nums">{selectedCount} selected</span>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast.info(`Add ${selectedCount} to playlist (Phase 2)`)}
            >
              <ListPlus className="size-4" /> Add to playlist
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast.success(`Favorited ${selectedCount}`)}
            >
              <Heart className="size-4" /> Favorite
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => toast.warning(`Move ${selectedCount} to trash (Phase 3)`)}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
