import { Info } from "lucide-react";
import type { DataSource } from "@/lib/types";

/** Shown when the UI is displaying sample data because Navidrome isn't wired up. */
export function SourceBanner({ source, error }: { source: DataSource; error?: string }) {
  if (source === "navidrome") return null;
  return (
    <div className="mx-6 mb-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>
        <span className="font-medium">Showing sample data.</span> Set{" "}
        <code className="rounded bg-black/30 px-1">NAVIDROME_URL</code>,{" "}
        <code className="rounded bg-black/30 px-1">NAVIDROME_USERNAME</code> and{" "}
        <code className="rounded bg-black/30 px-1">NAVIDROME_PASSWORD</code> to load your real
        library.
        {error && <span className="block text-amber-200/70">Last error: {error}</span>}
      </div>
    </div>
  );
}
