"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { usePlayer } from "@/components/player-provider";
import { ACTIVE, isFailed } from "@/lib/import/summarize";
import { previewTrack } from "@/lib/player-track";
import type { ImportBatch, ImportJob } from "@/lib/import/store";

function JobStatusLabel({ job }: { job: ImportJob }) {
  const s = job.status;
  if (ACTIVE.includes(s))
    return <span className="inline-flex items-center gap-1.5 text-xs text-blue-300">{s}</span>;
  if (s === "added")
    return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">added</span>;
  if (s === "needs_review")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 px-1.5 py-0.5 text-xs text-amber-300">
        needs review
      </span>
    );
  if (s === "skipped") return <span className="text-xs text-muted-foreground">skipped</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
      {s.replace(/_/g, " ")}
    </span>
  );
}

export function JobList({
  batch,
  only,
  onResolve,
  onRetryRow,
}: {
  batch: ImportBatch;
  only?: (j: ImportJob) => boolean;
  onResolve: (batchId: string, jobId: string, action: "pick" | "skip", songId?: string) => void;
  onRetryRow: (line: string) => void;
}) {
  const player = usePlayer();
  const jobs = only ? batch.jobs.filter(only) : batch.jobs;
  return (
    <table className="w-full text-sm">
      <tbody>
        {jobs.map((job) => {
          const preview = job.deezer?.preview;
          const playing = player.isCurrent(job.id) && player.playing;
          return (
            <tr key={job.id} className="border-b border-border/40 align-top last:border-0">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  {preview && (
                    <button
                      onClick={() =>
                        player.toggle(
                          previewTrack(
                            job.id,
                            job.title ?? job.line,
                            preview,
                            job.artist,
                            job.deezer?.cover,
                          ),
                        )
                      }
                      aria-label={playing ? "Pause preview" : "Play preview"}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </button>
                  )}
                  <span className="font-medium">{job.title ?? job.line}</span>
                </div>
                <div className="text-xs text-muted-foreground">{job.artist}</div>
                {job.error && <div className="text-xs text-red-400/80">{job.error}</div>}
                {job.status === "needs_review" && job.candidates && job.candidates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.candidates.map((cand) => (
                      <button
                        key={cand.id}
                        onClick={() => onResolve(batch.id, job.id, "pick", cand.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary hover:bg-primary/10"
                      >
                        {cand.title} — <span className="text-muted-foreground">{cand.artist}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => onResolve(batch.id, job.id, "skip")}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      skip
                    </button>
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <JobStatusLabel job={job} />
                  {isFailed(job) && (
                    <button
                      onClick={() => onRetryRow(job.line)}
                      title="Retry this track"
                      aria-label="Retry this track"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
