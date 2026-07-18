"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListVideo, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Playlist } from "@/lib/types";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function PlaylistsManager({ playlists }: { playlists: Playlist[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteSongs, setDeleteSongs] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    const name = window.prompt("New playlist name")?.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Created "${name}"`);
      router.refresh();
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function confirmDelete(pl: Playlist) {
    setBusy(true);
    try {
      const res = await fetch(`/api/playlists?id=${encodeURIComponent(pl.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (deleteSongs) {
        // Song trashing rides on the Phase-3 move-to-trash flow.
        toast.info(`Deleted "${pl.name}". Trashing its ${pl.songCount} songs lands in Phase 3 — files kept for now.`);
      } else {
        toast.success(`Deleted "${pl.name}" (songs kept in library)`);
      }
      setPendingId(null);
      setDeleteSongs(false);
      router.refresh();
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={create}>
          <Plus className="size-4" /> New playlist
        </Button>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {playlists.map((pl) => (
          <div key={pl.id} className="flex items-center gap-3 px-4 py-3">
            <Link
              href={`/?playlist=${encodeURIComponent(pl.id)}`}
              className="group flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <ListVideo className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium group-hover:underline">{pl.name}</div>
                <div className="text-sm text-muted-foreground tabular-nums">
                  {pl.songCount} songs · {formatDuration(pl.durationSecs)}
                  {pl.public && " · public"}
                </div>
              </div>
            </Link>

            {pendingId === pl.id ? (
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={deleteSongs}
                    onCheckedChange={(v) => setDeleteSongs(!!v)}
                  />
                  also delete songs
                </label>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => confirmDelete(pl)}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPendingId(null);
                    setDeleteSongs(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setPendingId(pl.id)}
                aria-label={`Delete ${pl.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
