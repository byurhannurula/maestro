"use client";

import { toast } from "sonner";
import { apiPost } from "@/hooks/use-api";
import { deleteToTrash } from "@/lib/delete-to-trash";
import type { Song } from "@/lib/types";

export async function persistStar(ids: string[], starred: boolean) {
  await apiPost("/api/star", { ids, starred });
}

export function toggleHeart(
  s: Song,
  stars: Record<string, boolean>,
  setStars: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
  const current = stars[s.id] ?? s.starred;
  const next = !current;
  setStars((prev) => ({ ...prev, [s.id]: next }));
  persistStar([s.id], next).catch((e) => {
    setStars((prev) => ({ ...prev, [s.id]: current }));
    toast.error(`Favourite failed: ${e instanceof Error ? e.message : e}`);
  });
}

export async function bulkFavorite(
  ids: string[],
  setStars: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
) {
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

export async function addSelectedToPlaylist(
  id: string,
  name: string,
  songIds: string[],
  clearSelected: () => void,
  routerRefresh: () => void,
) {
  try {
    await apiPost("/api/playlist-add", { playlistId: id, songIds });
    toast.success(`Added ${songIds.length} to "${name}"`);
    clearSelected();
    routerRefresh();
  } catch (e) {
    toast.error(`Add failed: ${e instanceof Error ? e.message : e}`);
  }
}

export async function removeFromPlaylist(
  indices: number[],
  playlistId: string,
  clearSelected: () => void,
  routerRefresh: () => void,
  reload: () => void,
) {
  if (indices.length === 0) return;
  try {
    await apiPost("/api/playlist-remove", { playlistId, indices });
    toast.success(`Removed ${indices.length} from playlist`);
    clearSelected();
    routerRefresh();
    reload();
  } catch (e) {
    toast.error(`Remove failed: ${e instanceof Error ? e.message : e}`);
  }
}

export function bulkRemoveFromPlaylist(
  songs: Song[],
  selected: Set<string>,
  setRemoveState: (state: { indices: number[]; count: number }) => void,
) {
  const indices = songs
    .filter((s) => selected.has(s.id))
    .map((s) => s.playlistIndex)
    .filter((n): n is number => n != null);
  if (indices.length > 0) setRemoveState({ indices, count: indices.length });
}

export async function confirmDelete(
  ids: string[],
  setDeleting: (v: boolean) => void,
  setSongs: React.Dispatch<React.SetStateAction<Song[]>>,
  clearSelected: () => void,
  closeDeleteDialog: () => void,
  routerRefresh: () => void,
) {
  if (ids.length === 0) return;
  setDeleting(true);
  try {
    const result = await deleteToTrash(ids);
    if (result) {
      setSongs((prev) => prev.filter((s) => !result.okIds.has(s.id)));
      clearSelected();
      closeDeleteDialog();
      routerRefresh();
    }
  } finally {
    setDeleting(false);
  }
}
