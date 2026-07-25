"use client";

import { CalendarClock, Heart, Loader2, Search, SlidersHorizontal } from "lucide-react";
import {
  COLUMNS,
  PAGE_SIZES,
  STALE_OPTIONS,
  TOGGLEABLE,
  staleLabel,
} from "@/components/tables/songs-table-columns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ColId } from "@/components/tables/songs-table-columns";
import type { RefObject } from "react";

export function TableToolbar({
  searchRef,
  searchInput,
  onSearchChange,
  searchHint,
  favoritesOnly,
  onToggleFavorites,
  unplayedOnly,
  staleDays,
  onStaleDaysChange,
  hiddenCols,
  onToggleColumn,
  combineArtist,
  onToggleCombineArtist,
  pageSize,
  onPageSizeChange,
  loading,
  source,
  songCount,
  total,
  reachedEnd,
}: {
  searchRef: RefObject<HTMLInputElement | null>;
  searchInput: string;
  onSearchChange: (val: string) => void;
  searchHint: string | null;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  unplayedOnly: boolean;
  staleDays: number;
  onStaleDaysChange: (days: number) => void;
  hiddenCols: ColId[];
  onToggleColumn: (id: ColId) => void;
  combineArtist: boolean;
  onToggleCombineArtist: () => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  loading: boolean;
  source: string;
  songCount: number;
  total: number;
  reachedEnd: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 sm:gap-3 sm:px-6">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
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
        onClick={onToggleFavorites}
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
              onValueChange={(v) => onStaleDaysChange(Number(v))}
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
                checked={!hiddenCols.includes(c.id)}
                disabled={c.id === "artist" && combineArtist}
                onCheckedChange={() => onToggleColumn(c.id)}
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
              onCheckedChange={onToggleCombineArtist}
            >
              Combine artist
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
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
            {songCount.toLocaleString()} never-played{reachedEnd ? "" : "+"}
          </>
        ) : (
          <>
            showing {songCount.toLocaleString()} of {total.toLocaleString()}
          </>
        )}
      </div>
    </div>
  );
}
