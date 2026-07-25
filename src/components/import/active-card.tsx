"use client";

import { Loader2 } from "lucide-react";
import { JobList } from "@/components/import/job-list";
import { Badge } from "@/components/ui/badge";
import { ACTIVE, summarize, type Counts } from "@/lib/import/summarize";
import type { ImportBatch } from "@/lib/import/store";

export function BatchBadges({ c }: { c: Counts }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs">
      {c.added > 0 && (
        <Badge variant="secondary" className="text-emerald-400">
          {c.added} added
        </Badge>
      )}
      {c.review > 0 && (
        <Badge variant="outline" className="border-amber-500/40 text-amber-300">
          {c.review} review
        </Badge>
      )}
      {c.failed > 0 && (
        <Badge variant="outline" className="border-red-500/40 text-red-400">
          {c.failed} failed
        </Badge>
      )}
      {c.active > 0 && <Badge variant="outline">{c.active} running</Badge>}
    </div>
  );
}

export function ActiveCard({
  batch,
  title,
  onResolve,
  onRetryRow,
}: {
  batch: ImportBatch;
  title: string;
  onResolve: (batchId: string, jobId: string, action: "pick" | "skip", songId?: string) => void;
  onRetryRow: (line: string) => void;
}) {
  const total = batch.jobs.length;
  const settled = batch.jobs.filter((j) => !ACTIVE.includes(j.status)).length;
  const pct = total ? Math.round((settled / total) * 100) : 0;
  return (
    <div className="overflow-hidden rounded-lg border border-primary/40 bg-primary/[0.03]">
      <div className="flex items-center gap-3 px-4 py-3">
        <Loader2 className="size-4 shrink-0 animate-spin text-blue-300" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {settled} / {total} processed
          </div>
        </div>
        <BatchBadges c={summarize(batch.jobs)} />
      </div>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="border-t border-border">
        <JobList batch={batch} onResolve={onResolve} onRetryRow={onRetryRow} />
      </div>
    </div>
  );
}
