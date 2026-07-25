"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Link2,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePlayer } from "@/components/player-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiJson, apiPost } from "@/hooks/use-api";
import { parseImportList, type ParsedLine } from "@/lib/import/parse";
import { cn } from "@/lib/utils";
import type { ImportBatch, ImportJob, JobStatus } from "@/lib/import/store";
import type { Playlist } from "@/lib/types";

const ACTIVE: JobStatus[] = ["queued", "searching", "downloading", "scanning", "matching"];
const FAILED: JobStatus[] = ["not_found", "download_failed", "add_failed"];
const NO_PLAYLIST = "No playlist";
const IMPORT_URL = "/api/import";

type Filter = "all" | "review" | "failed";

interface Counts {
  added: number;
  review: number;
  failed: number;
  skipped: number;
  active: number;
}

function summarize(jobs: ImportJob[]): Counts {
  const c: Counts = { added: 0, review: 0, failed: 0, skipped: 0, active: 0 };
  for (const j of jobs) {
    if (j.status === "added") c.added++;
    else if (j.status === "needs_review") c.review++;
    else if (j.status === "skipped") c.skipped++;
    else if (FAILED.includes(j.status)) c.failed++;
    else c.active++;
  }
  return c;
}

const isFailed = (j: ImportJob) => FAILED.includes(j.status);

function timeAgo(ms: number): string {
  const d = Math.max(0, Date.now() - ms);
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function batchTitle(b: ImportBatch, playlists: Playlist[]): string {
  return b.playlistName ?? playlists.find((p) => p.id === b.playlistId)?.name ?? NO_PLAYLIST;
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
    label: NO_PLAYLIST,
  });
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<
    { kind: "batch"; id: string; label: string } | { kind: "clear"; count: number } | null
  >(null);

  const parsed = useMemo(() => parseImportList(text), [text]);
  const skippedLines = useMemo(() => {
    const nonEmpty = text.split(/\r?\n/).filter((l) => l.trim() !== "").length;
    return Math.max(0, nonEmpty - parsed.length);
  }, [text, parsed.length]);

  const active = batches.filter((b) => !b.done);
  const finished = batches.filter((b) => b.done);

  // All-time totals across every stored batch.
  const stats = useMemo(() => {
    const t = { added: 0, review: 0, failed: 0 };
    for (const b of batches)
      for (const j of b.jobs) {
        if (j.status === "added") t.added++;
        else if (j.status === "needs_review") t.review++;
        else if (isFailed(j)) t.failed++;
      }
    return t;
  }, [batches]);

  const visibleFinished = finished.filter((b) => {
    if (filter === "all") return true;
    const c = summarize(b.jobs);
    return filter === "review" ? c.review > 0 : c.failed > 0;
  });

  async function refresh(): Promise<boolean> {
    try {
      const data = await apiJson<{ batches: ImportBatch[] }>(IMPORT_URL);
      setBatches(data.batches);
      return data.batches.some((b) => !b.done);
    } catch {
      return false;
    }
  }

  // Self-scheduling poll: fast while something runs, slow when idle.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      const running = await refresh();
      timer = setTimeout(tick, running ? 1500 : 6000);
    };
    void tick();
    return () => {
      alive = false;
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

  async function submit(body: { text: string; playlistId?: string; playlistName?: string }): Promise<string> {
    const data = await apiPost<{ batchId: string }>(IMPORT_URL, body);
    setExpanded((s) => new Set(s).add(data.batchId));
    await refresh();
    return data.batchId;
  }

  async function start() {
    if (parsed.length === 0) return toast.error("Nothing to import");
    setStarting(true);
    try {
      await submit({ text, playlistId: target.id, playlistName: target.name });
      setText("");
    } catch (e) {
      toast.error(`Import failed to start: ${e instanceof Error ? e.message : e}`);
    } finally {
      setStarting(false);
    }
  }

  /** Re-run a set of lines as a fresh batch into the original target playlist. */
  async function retry(lines: string[], b: ImportBatch) {
    if (lines.length === 0) return;
    try {
      await submit({
        text: lines.join("\n"),
        playlistId: b.playlistId,
        playlistName: b.playlistId ? undefined : b.playlistName,
      });
      toast.success(`Retrying ${lines.length} track${lines.length === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(`Retry failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function resolve(batchId: string, jobId: string, action: "pick" | "skip", songId?: string) {
    try {
      await apiPost(`/api/import/${batchId}/resolve`, { jobId, action, songId });
      await refresh();
    } catch (e) {
      toast.error(`Action failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function doConfirm() {
    if (!confirm) return;
    try {
      if (confirm.kind === "batch") {
        await apiJson(`/api/import/${confirm.id}`, { method: "DELETE" });
      } else {
        await apiJson(IMPORT_URL, { method: "DELETE" });
      }
      await refresh();
    } catch (e) {
      toast.error(`Remove failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setConfirm(null);
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
    <div className="flex flex-col gap-8 px-4 pb-10 sm:px-6">
      {/* ── Step 1 · Source ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <StepHeading n={1} title="Paste or drop your list" />
        <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
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
              placeholder={"Dua Lipa - IDGAF\nBUNT. - Crown\n# lines starting with # are ignored"}
              className="h-56 w-full flex-1 resize-none rounded-lg border border-border bg-card p-4 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ParsePreview lines={parsed} skipped={skippedLines} />
        </div>
      </section>

      {/* ── Step 2 · Target + Start ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <StepHeading n={2} title="Choose a target playlist and start" />
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-accent">
              <span className="truncate">
                Target: <span className="font-medium text-foreground">{target.label}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuItem onClick={() => setTarget({ label: NO_PLAYLIST })}>
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

          <Badge variant="secondary" className="tabular-nums">
            {parsed.length} importable
          </Badge>

          <Button className="ml-auto" onClick={start} disabled={starting || parsed.length === 0}>
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Start import
          </Button>
        </div>
      </section>

      {/* ── Active imports ──────────────────────────────────────────── */}
      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Running now
          </h2>
          <div className="flex flex-col gap-3">
            {active.map((b) => (
              <ActiveCard
                key={b.id}
                batch={b}
                title={batchTitle(b, playlists)}
                onResolve={resolve}
                onRetryRow={(line) => retry([line], b)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── History ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </h2>
          {finished.length > 0 && (
            <button
              onClick={() => setConfirm({ kind: "clear", count: finished.length })}
              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear finished
            </button>
          )}
        </div>

        {/* All-time stat strip */}
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          <Stat label="Added" value={stats.added} tone="emerald" />
          <Stat label="Needs review" value={stats.review} tone="amber" />
          <Stat label="Failed" value={stats.failed} tone="red" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {(["all", "review", "failed"] as Filter[]).map((f) => {
            const count = f === "review" ? stats.review : f === "failed" ? stats.failed : undefined;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {f === "all" ? "All" : f}
                {count !== undefined && count > 0 && (
                  <span className="ml-1 tabular-nums opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {finished.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            No imports yet. Paste a list above and hit Start import.
          </p>
        ) : visibleFinished.length === 0 ? (
          <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
            Nothing matches this filter.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleFinished.map((b) => {
              const c = summarize(b.jobs);
              const isOpen = filter !== "all" || expanded.has(b.id);
              const only =
                filter === "review"
                  ? (j: ImportJob) => j.status === "needs_review"
                  : filter === "failed"
                    ? isFailed
                    : undefined;
              return (
                <div key={b.id} className="overflow-hidden rounded-lg border border-border">
                  <div className="flex items-center gap-1 pr-2 hover:bg-muted/40">
                    <button
                      onClick={() => toggle(b.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {batchTitle(b, playlists)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {timeAgo(b.createdAt)} · {b.jobs.length} tracks
                        </div>
                      </div>
                      <BatchBadges c={c} />
                    </button>
                    {c.failed > 0 && (
                      <button
                        onClick={() =>
                          retry(
                            b.jobs.filter(isFailed).map((j) => j.line),
                            b,
                          )
                        }
                        title="Retry failed as a new import"
                        aria-label="Retry failed"
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <RotateCcw className="size-4" />
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setConfirm({ kind: "batch", id: b.id, label: batchTitle(b, playlists) })
                      }
                      title="Remove from history"
                      aria-label="Remove from history"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border">
                      {b.error && <div className="px-4 py-2 text-xs text-red-400">{b.error}</div>}
                      <JobList
                        batch={b}
                        only={only}
                        onResolve={resolve}
                        onRetryRow={(line) => retry([line], b)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "clear"
                ? `Clear ${confirm.count} finished import${confirm.count === 1 ? "" : "s"}?`
                : `Remove "${confirm?.label}" from history?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This only clears the import log — downloaded files and playlist membership are not
              touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doConfirm();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums text-secondary-foreground">
        {n}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const color =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "red"
          ? "text-red-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div
        className={cn("text-xl font-semibold tabular-nums", value > 0 ? color : "text-foreground")}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** Live preview of how each pasted line will be interpreted. */
function ParsePreview({ lines, skipped }: { lines: ParsedLine[]; skipped: number }) {
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

function BatchBadges({ c }: { c: Counts }) {
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

/** A running batch: prominent, with a progress bar and its job list always shown. */
function ActiveCard({
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

function JobList({
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
                        player.toggle({
                          id: job.id,
                          title: job.title ?? job.line,
                          artist: job.artist,
                          src: `/api/preview?url=${encodeURIComponent(preview)}`,
                          coverUrl: job.deezer?.cover,
                          source: "preview",
                        })
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
