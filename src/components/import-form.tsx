"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Download, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { parseImportList } from "@/lib/parse-import";
import type { ImportBatch, ImportJob, JobStatus } from "@/lib/import-store";
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

function StatusBadge({ job }: { job: ImportJob }) {
  const s = job.status;
  if (ACTIVE.includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-blue-300">
        <Loader2 className="size-3 animate-spin" /> {s}
      </span>
    );
  }
  if (s === "added") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
        <CheckCircle2 className="size-3" /> added
      </span>
    );
  }
  if (s === "needs_review") {
    return <Badge variant="outline" className="border-amber-500/40 text-amber-300">needs review</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
      <XCircle className="size-3" /> {s.replace(/_/g, " ")}
    </span>
  );
}

export function ImportForm({ playlists }: { playlists: Playlist[] }) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<{ id?: string; name?: string; label: string }>({
    label: "No playlist",
  });
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsed = useMemo(() => parseImportList(text), [text]);
  const running = batch != null && !batch.done;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    toast.success(`Loaded ${file.name}`);
  }

  function poll(batchId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/import/${batchId}`);
        if (!res.ok) return;
        const data: ImportBatch = await res.json();
        setBatch(data);
        if (data.done && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
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
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      const data: { batchId: string; jobs: ImportJob[] } = await res.json();
      setBatch({ id: data.batchId, createdAt: Date.now(), jobs: data.jobs, done: false });
      poll(data.batchId);
    } catch (e) {
      toast.error(`Import failed to start: ${e instanceof Error ? e.message : e}`);
    } finally {
      setStarting(false);
    }
  }

  const jobs = batch?.jobs ?? [];
  const addedCount = jobs.filter((j) => j.status === "added").length;
  const doneCount = jobs.filter((j) => !ACTIVE.includes(j.status)).length;

  return (
    <div className="grid gap-6 px-6 pb-10 lg:grid-cols-2">
      {/* Input */}
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
            "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors",
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
          disabled={running}
          placeholder={"Dua Lipa - IDGAF\nBUNT. - Crown\nTwo Door Cinema Club,RAC - Next Year (RAC Remix)"}
          className="h-72 w-full resize-none rounded-lg border border-border bg-card p-4 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />

        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm hover:bg-accent">
              Target: <span className="font-medium text-foreground">{target.label}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
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

          <Badge variant="secondary">{parsed.length} parsed</Badge>

          <Button className="ml-auto" onClick={start} disabled={running || starting || parsed.length === 0}>
            {starting || running ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {running ? "Importing…" : "Start import"}
          </Button>
        </div>
      </div>

      {/* Status / preview */}
      <div className="flex min-h-0 flex-col rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm font-medium">
          <span>{batch ? "Import status" : "Preview"}</span>
          {batch && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {addedCount} added · {doneCount}/{jobs.length} done
              {batch.done && " · complete"}
            </span>
          )}
        </div>

        <div className="max-h-[32rem] overflow-y-auto">
          {!batch ? (
            parsed.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Parsed rows appear here as you type or drop a file.
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-2">{row.primaryArtist ?? "—"}</td>
                      <td className="px-4 py-2">{row.title ?? row.url}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{job.title ?? job.line}</div>
                      <div className="text-xs text-muted-foreground">{job.artist}</div>
                      {job.error && <div className="text-xs text-red-400/80">{job.error}</div>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <StatusBadge job={job} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
