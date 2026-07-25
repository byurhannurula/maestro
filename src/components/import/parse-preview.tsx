"use client";

import { Link2, Search } from "lucide-react";
import type { ParsedLine } from "@/lib/import/parse";

export function ParsePreview({ lines, skipped }: { lines: ParsedLine[]; skipped: number }) {
  const CAP = 60;
  return (
    <div className="flex min-h-56 flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Preview</span>
        <span className="flex items-center gap-2 tabular-nums">
          <span className="text-foreground">{lines.length} importable</span>
          {skipped > 0 && <span className="text-muted-foreground">{skipped} skipped</span>}
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Parsed lines appear here as you type.
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-border/40 overflow-y-auto">
          {lines.slice(0, CAP).map((p, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              {p.kind === "url" ? (
                <>
                  <Link2 className="size-3.5 shrink-0 text-blue-300" />
                  <span className="truncate text-muted-foreground">{p.url}</span>
                </>
              ) : p.primaryArtist ? (
                <>
                  <span className="truncate font-medium">{p.title}</span>
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <span className="truncate text-muted-foreground">{p.primaryArtist}</span>
                  {p.artists.length > 1 && (
                    <span className="shrink-0 text-xs text-muted-foreground/60">
                      +{p.artists.length - 1}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{p.raw}</span>
                </>
              )}
            </li>
          ))}
          {lines.length > CAP && (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">
              +{lines.length - CAP} more…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
