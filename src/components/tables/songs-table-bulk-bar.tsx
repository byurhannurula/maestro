"use client";

import { Heart, ListPlus, ListX, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Playlist } from "@/lib/types";

export function BulkActionBar({
  selectedCount,
  playlists,
  playlistId,
  onCreatePlaylist,
  onAddToPlaylist,
  onFavorite,
  onRemoveFromPlaylist,
  onDelete,
  onClear,
}: {
  selectedCount: number;
  playlists: Playlist[];
  playlistId?: string;
  onCreatePlaylist: () => void;
  onAddToPlaylist: (id: string, name: string) => void;
  onFavorite: () => void;
  onRemoveFromPlaylist: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-(--player-bar-offset,1.5rem) flex justify-center px-3 transition-[bottom] duration-200">
      <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2 py-2 shadow-lg sm:gap-2 sm:px-3">
        <span className="whitespace-nowrap px-1 text-sm font-medium tabular-nums sm:px-2">
          {selectedCount}
          <span className="hidden sm:inline"> selected</span>
        </span>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger
            aria-label="Add to playlist"
            className="inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-sm hover:bg-accent hover:text-accent-foreground sm:px-3"
          >
            <ListPlus className="size-4" />{" "}
            <span className="hidden sm:inline">Add to playlist</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="max-h-72 w-56 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => {
                setOpen(false);
                onCreatePlaylist();
              }}
            >
              <Plus className="size-4" /> New playlist…
            </DropdownMenuItem>
            {playlists.length > 0 && <DropdownMenuSeparator />}
            {playlists.map((pl) => (
              <DropdownMenuItem
                key={pl.id}
                onClick={() => {
                  setOpen(false);
                  onAddToPlaylist(pl.id, pl.name);
                }}
              >
                <span className="truncate">{pl.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="ghost"
          onClick={onFavorite}
          aria-label="Favourite"
          className="whitespace-nowrap"
        >
          <Heart className="size-4" /> <span className="hidden sm:inline">Favourite</span>
        </Button>
        {playlistId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemoveFromPlaylist}
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
          onClick={onDelete}
        >
          <Trash2 className="size-4" /> <span className="hidden sm:inline">Delete</span>
        </Button>
        <div className="mx-0.5 h-5 w-px bg-border sm:mx-1" />
        <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X className="size-4 sm:hidden" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  );
}
