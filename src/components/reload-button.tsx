"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

/**
 * Clears the in-memory read cache (songs / playlists / discovery) and re-pulls
 * from Navidrome. Same effect as the `r` shortcut and the sidebar item, but
 * always visible in the page header for when cached data looks stale.
 */
export function ReloadButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (busy) return;
    setBusy(true);
    try {
      await apiPost("/api/reload");
    } catch {
      /* refresh anyway */
    }
    router.refresh();
    toast.success("Cache cleared & reloaded");
    setBusy(false);
  }

  return (
    <button
      onClick={reload}
      disabled={busy}
      title="Clear cache & reload (r)"
      aria-label="Clear cache and reload"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("size-4", busy && "animate-spin")} />
    </button>
  );
}
