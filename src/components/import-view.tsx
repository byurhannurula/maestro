"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { parseImportList } from "@/lib/import/parse";
import type { ImportBatch, ImportJob, JobStatus } from "@/lib/import/store";
import type { Playlist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACTIVE: JobStatus[] = ["queued", "searching", "downloading", "scanning", "matching"];
const FAILED: JobStatus[] = ["not_found", "download_failed", "add_failed"];

function summarize(jobs: ImportJob[]) {
  const c = { added: 0, review: 0, failed: 0, skipped: 0, active: 0 };
  for (const j of jobs) {
    if (j.status === "added") c.added++;
    else if (j.status === "needs_review") c.review++;
    else if (j.status === "skipped") c.skipped++;
    else if (FAILED.includes(j.status)) c.failed++;
    else c.active++;
  }
  return c;
}

function timeAgo(ms: number): string {
  const d = Math.max(0, Date.now() - ms);
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function JobStatusLabel({ job }: { job: ImportJob }) {
  const s = job.status;
  if (ACTIVE.includes(s))
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-300">
        <Loader2 className="size-3 animate-spin" /> {s}
      </span>
    );
  if (s === "added")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 className="size-3" /> added
      </span>
    );
  if (s === "needs_review")
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
        needs review
      </Badge>
    );
  if (s === "skipped") return <span className="text-xs text-muted-foreground">skipped</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
      <XCircle className="size-3" /> {s.replace(/_/g, " ")}
    </span>
  );
}

export function ImportView({ playlists }: { playlists: Playlist[] }) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<{ id?: string; name?: string; label: string }>({
    label: "No playlist",
  });
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  const parsed = useMemo(() => parseImportList(text), [text]);

  async function refresh(): Promise<boolean> {
    try {
      const res = await fetch("/api/import");
      if (!res.ok) return false;
      const data: { batches: ImportBatch[] } = await res.json();
      setBatches(data.batches);
      return data.batches.some((b) => !b.done);
    } catch {
      return false;
    }
  }

  // Self-scheduling poll: fast while something runs, slow when idle.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!active) return;
      const running = await refresh();
      timer = setTimeout(tick, running ? 1500 : 6000);
    };
    void tick();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    toast.success(`Loaded ${file.name}`);
  }

  async function start() {
    if (parsed.length === 0) return toast.error("Nothing to import");
    setStarting(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, playlistId: target.id, playlistName: target.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setText("");
      setExpanded((s) => new Set(s).add(data.batchId));
      await refresh();
    } catch (e) {
      toast.error(`Import failed to start: ${e instanceof Error ? e.message : e}`);
    } finally {
      setStarting(false);
    }
  }

  async function resolve(batchId: string, jobId: string, action: "pick" | "skip", songId?: string) {
    try {
      const res = await fetch(`/api/import/${batchId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, action, songId }),
      });
      if (!res.ok)
        throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      toast.error(`Action failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8 px-6 pb-10">
      {/* Input */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex flex-col gap-3">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm transition-colors",
              dragging
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            <Upload className="size-4" />
            Drop a .txt / .csv here, or click to browse
            <input
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"Dua Lipa - IDGAF\nBUNT. - Crown"}
            className="h-40 w-full resize-none rounded-lg border border-border bg-card p-4 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex items-center gap-3 lg:flex-col lg:items-stretch">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-accent">
              <span className="truncate">
                Target: <span className="font-medium text-foreground">{target.label}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuItem onClick={() => setTarget({ label: "No playlist" })}>
                No playlist
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const name = window.prompt("New playlist name")?.trim();
                  if (name) setTarget({ name, label: `${name} (new)` });
                }}
              >
                New playlist…
              </DropdownMenuItem>
              {playlists.length > 0 && <DropdownMenuSeparator />}
              {playlists.map((pl) => (
                <DropdownMenuItem
                  key={pl.id}
                  onClick={() => setTarget({ id: pl.id, label: pl.name })}
                >
                  <span className="truncate">{pl.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">{parsed.length} parsed</Badge>
            <Button onClick={start} disabled={starting || parsed.length === 0}>
              {starting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Start
            </Button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Imports
        </h2>
        {batches.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No imports yet. Paste a list above and hit Start.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {batches.map((b) => {
              const c = summarize(b.jobs);
              const isOpen = expanded.has(b.id);
              return (
                <div key={b.id} className="overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => toggle(b.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {b.playlistName ??
                          playlists.find((p) => p.id === b.playlistId)?.name ??
                          "No playlist"}
                        {!b.done && <Loader2 className="size-3.5 animate-spin text-blue-300" />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {timeAgo(b.createdAt)} · {b.jobs.length} tracks
                      </div>
                    </div>
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
                  </button>

                  {isOpen && (
                    <div className="border-t border-border">
                      {b.error && <div className="px-4 py-2 text-xs text-red-400">{b.error}</div>}
                      <table className="w-full text-sm">
                        <tbody>
                          {b.jobs.map((job) => (
                            <tr
                              key={job.id}
                              className="border-b border-border/40 last:border-0 align-top"
                            >
                              <td className="px-4 py-2">
                                <div className="font-medium">{job.title ?? job.line}</div>
                                <div className="text-xs text-muted-foreground">{job.artist}</div>
                                {job.error && (
                                  <div className="text-xs text-red-400/80">{job.error}</div>
                                )}
                                {job.status === "needs_review" &&
                                  job.candidates &&
                                  job.candidates.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {job.candidates.map((c) => (
                                        <button
                                          key={c.id}
                                          onClick={() => resolve(b.id, job.id, "pick", c.id)}
                                          className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary hover:bg-primary/10"
                                        >
                                          {c.title} —{" "}
                                          <span className="text-muted-foreground">{c.artist}</span>
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => resolve(b.id, job.id, "skip")}
                                        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                                      >
                                        skip
                                      </button>
                                    </div>
                                  )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 text-right">
                                <JobStatusLabel job={job} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
