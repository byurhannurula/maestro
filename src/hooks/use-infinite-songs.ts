"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DataSource, Song, SongSortKey, SongsResult } from "@/lib/types";

export interface SongQueryParams {
  sort: SongSortKey;
  order: "ASC" | "DESC";
  search: string;
  playlistId?: string;
  favoritesOnly: boolean;
  unplayedOnly: boolean;
  /** Cleanup age cutoff in days (only applied when unplayedOnly). */
  staleDays: number;
  pageSize: number;
}

/**
 * Server-driven, deduped, infinite-scroll song loading. Re-queries from the top
 * whenever the query params change; `loadMore()` appends the next page. The
 * server offset is tracked separately from the deduped display list so paging
 * stays correct even when the library has duplicate rows.
 */
export function useInfiniteSongs(initial: SongsResult, params: SongQueryParams) {
  const [songs, setSongs] = useState<Song[]>(initial.songs);
  const [total, setTotal] = useState(initial.total);
  const [source, setSource] = useState<DataSource>(initial.source);
  const [loading, setLoading] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(initial.songs.length >= initial.total);

  const serverOffset = useRef(initial.songs.length);
  const seenIds = useRef(new Set(initial.songs.map((s) => s.id)));
  const firstRun = useRef(true);
  const inFlight = useRef(false);

  const { sort, order, search, playlistId, favoritesOnly, unplayedOnly, staleDays, pageSize } =
    params;

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;

      const start = reset ? 0 : serverOffset.current;
      const qp = new URLSearchParams({
        start: String(start),
        end: String(start + pageSize),
        sort,
        order,
      });
      const term = search.trim();
      if (term) qp.set("search", term);
      if (playlistId) qp.set("playlist", playlistId);
      if (favoritesOnly) qp.set("favorites", "1");
      if (unplayedOnly) {
        qp.set("unplayed", "1");
        if (staleDays > 0) qp.set("staleDays", String(staleDays));
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/songs?${qp.toString()}`);
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

        const heuristicOnly = !!term && !playlistId;
        setReachedEnd(
          data.songs.length === 0 ||
            (heuristicOnly ? data.songs.length < pageSize : serverOffset.current >= data.total),
        );
      } catch (e) {
        toast.error(`Failed to load songs: ${e instanceof Error ? e.message : e}`);
        setReachedEnd(true);
      } finally {
        setLoading(false);
        inFlight.current = false;
      }
    },
    [sort, order, search, playlistId, favoritesOnly, unplayedOnly, staleDays, pageSize],
  );

  // Re-query from the top whenever the query changes (skip the initial mount).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    void fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && !reachedEnd) void fetchPage(false);
  }, [loading, reachedEnd, fetchPage]);

  const reload = useCallback(() => {
    void fetchPage(true);
  }, [fetchPage]);

  return { songs, setSongs, total, source, loading, reachedEnd, loadMore, reload };
}
