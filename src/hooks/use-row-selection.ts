"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Song, SongSortKey } from "@/lib/types";

export function useRowSelection(
  songs: Song[],
  queryDeps: {
    sort: SongSortKey;
    order: "ASC" | "DESC";
    search: string;
    playlistId?: string;
    favoritesOnly: boolean;
    unplayedOnly: boolean;
    staleDays: number;
    pageSize: number;
  },
) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const shiftDown = useRef(false);
  const lastIndex = useRef<number | null>(null);

  const { sort, order, search, playlistId, favoritesOnly, unplayedOnly, staleDays, pageSize } =
    queryDeps;

  // Clear selection whenever the query changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const allSelected = songs.length > 0 && selected.size === songs.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedSongs = useMemo(() => songs.filter((s) => selected.has(s.id)), [songs, selected]);

  return { selected, setSelected, selectRow, allSelected, someSelected, selectedSongs };
}
