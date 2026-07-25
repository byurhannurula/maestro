"use client";

import { RefreshCw } from "lucide-react";
import { useReload } from "@/hooks/use-reload";
import { cn } from "@/lib/utils";

/**
 * Clears the in-memory read cache (songs / playlists / discovery) and re-pulls
 * from Navidrome. Same effect as the `r` shortcut and the sidebar item, but
 * always visible in the page header for when cached data looks stale.
 */
export function ReloadButton() {
  const { reload, reloading } = useReload();

  return (
    <button
      onClick={reload}
      disabled={reloading}
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
        reloading && "pointer-events-none opacity-50",
      )}
      aria-label="Reload library"
    >
      <RefreshCw className={cn("size-3.5", reloading && "animate-spin")} />
      {reloading ? "Reloading…" : "Reload"}
    </button>
  );
}
