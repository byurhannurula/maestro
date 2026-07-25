"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { apiPost } from "@/hooks/use-api";

export interface CreatePlaylistResult {
  id: string;
  name: string;
}

export function useCreatePlaylist() {
  const router = useRouter();

  const createPlaylist = useCallback(async (name?: string): Promise<CreatePlaylistResult | null> => {
    const resolvedName = name ?? window.prompt("New playlist name")?.trim();
    if (!resolvedName) return null;
    try {
      const data = await apiPost<{ playlists: Array<{ id: string; name: string }> }>(
        "/api/playlists",
        { name: resolvedName },
      );
      const created = data.playlists.find((p) => p.name === resolvedName);
      if (!created) {
        toast.success(`Created "${resolvedName}"`);
        router.refresh();
        return { id: "", name: resolvedName };
      }
      toast.success(`Created "${resolvedName}"`);
      router.refresh();
      return { id: created.id, name: created.name };
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }, [router]);

  return createPlaylist;
}
