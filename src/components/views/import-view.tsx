"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActiveCard, BatchBadges } from "@/components/import/active-card";
import { JobList } from "@/components/import/job-list";
import { ParsePreview } from "@/components/import/parse-preview";
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
import { useImportBatches } from "@/hooks/use-import-batches";
import { timeAgo } from "@/lib/format";
import { parseImportList } from "@/lib/import/parse";
import { batchTitle, isFailed, NO_PLAYLIST, summarize, type Filter } from "@/lib/import/summarize";
import { cn } from "@/lib/utils";
import type { ImportJob } from "@/lib/import/store";
import type { Playlist } from "@/lib/types";

export function ImportView({ playlists }: { playlists: Playlist[] }) {
  const {
    active,
    finished,
    visibleFinished,
    stats,
    filter,
    setFilter,
    expanded,
    confirm,
    setConfirm,
    submit,
    retry,
    resolve,
    doConfirm,
    toggle,
  } = useImportBatches();
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<{ id?: string; name?: string; label: string }>({
    label: NO_PLAYLIST,
  });
  const [starting, setStarting] = useState(false);

  const parsed = useMemo(() => parseImportList(text), [text]);
  const skippedLines = useMemo(() => {
    const nonEmpty = text.split(/\r?\n/).filter((l) => l.trim() !== "").length;
    return Math.max(0, nonEmpty - parsed.length);
  }, [text, parsed.length]);

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
      await submit({ text, playlistId: target.id, playlistName: target.name });
      setText("");
    } catch (e) {
      toast.error(`Import failed to start: ${e instanceof Error ? e.message : e}`);
    } finally {
      setStarting(false);
    }
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
              const isOpen = filter !== "all" || expanded.set.has(b.id);
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
