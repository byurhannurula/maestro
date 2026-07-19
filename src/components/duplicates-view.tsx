"use client";

import { AlertTriangle, Crown, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes, formatDuration, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DuplicateGroup, DuplicatesResult, Song } from "@/lib/types";

type Match = "conservative" | "aggressive";

function quality(s: Song): string {
  const parts: string[] = [];
  if (s.bitRate) parts.push(`${s.bitRate} kbps`);
  if (s.sizeBytes) parts.push(formatBytes(s.sizeBytes));
  return parts.join(" · ") || "—";
}

/** Drop trashed tracks from the groups, recomputing keeper/reclaimable, and
 *  discard any cluster that no longer has ≥2 copies. */
function pruneGroups(groups: DuplicateGroup[], removedIds: Set<string>): DuplicateGroup[] {
  const out: DuplicateGroup[] = [];
  for (const g of groups) {
    const members = g.members.filter((m) => !removedIds.has(m.id));
    if (members.length < 2) continue; // no longer a duplicate
    const durs = members.map((m) => m.durationSecs);
    out.push({
      ...g,
      members,
      versionsDiffer: Math.max(...durs) - Math.min(...durs) > 3,
      reclaimableBytes: members.slice(1).reduce((n, m) => n + (m.sizeBytes ?? 0), 0),
    });
  }
  return out;
}

export function DuplicatesView({ now }: { now: number }) {
  const router = useRouter();
  const [match, setMatch] = useState<Match>("conservative");
  const [data, setData] = useState<DuplicatesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (m: Match) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/duplicates?match=${m}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: DuplicatesResult = await res.json();
      setData(d);
      setSelected(new Set());
    } catch (e) {
      toast.error(`Failed to scan duplicates: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount and whenever the match mode changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(match);
  }, [match, load]);

  const groups = data?.groups ?? [];
  const allMembers = groups.flatMap((g) => g.members);
  const selectedSongs = allMembers.filter((s) => selected.has(s.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectOthers(memberIds: string[]) {
    // Everything but the keeper (first id) in this group.
    setSelected((prev) => {
      const next = new Set(prev);
      memberIds.slice(1).forEach((id) => next.add(id));
      return next;
    });
  }

  // Every non-keeper across all groups (keeper = first member of each group).
  const nonKeeperIds = groups.flatMap((g) => g.members.slice(1).map((m) => m.id));
  const allNonKeepersSelected =
    nonKeeperIds.length > 0 && nonKeeperIds.every((id) => selected.has(id));

  function toggleAllButKeepers() {
    // Toggle: if every non-keeper is already selected, clear; else select them all.
    setSelected(allNonKeepersSelected ? new Set() : new Set(nonKeeperIds));
  }

  async function confirmDelete() {
    const ids = selectedSongs.map((s) => s.id);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      const failedNote = body.failed ? `, ${body.failed} failed` : "";
      toast.success(`Moved ${body.moved} to trash${failedNote}`);
      setConfirmOpen(false);

      // Remove only the copies the server confirmed it moved, from local state.
      // Navidrome's purge-rescan is async, so re-querying now would race it and
      // the rows would linger; prune optimistically instead.
      const removedIds = new Set<string>(
        (body.results as Array<{ id?: string; ok?: boolean }> | undefined)
          ?.filter((r) => r.ok && r.id)
          .map((r) => r.id as string) ?? [],
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              groups: pruneGroups(prev.groups, removedIds),
              duplicateTracks: prev.duplicateTracks - removedIds.size,
            }
          : prev,
      );
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["conservative", "aggressive"] as Match[]).map((m) => (
            <button
              key={m}
              onClick={() => setMatch(m)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                match === m
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {match === "conservative"
            ? "Exact re-downloads; keeps remixes/versions separate."
            : "Also merges remaster / radio-edit / version tags."}
        </span>

        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
          {!loading && nonKeeperIds.length > 0 && (
            <Button size="sm" variant="ghost" className="text-xs" onClick={toggleAllButKeepers}>
              {allNonKeepersSelected
                ? "Clear selection"
                : `Select all but keepers (${nonKeeperIds.length})`}
            </Button>
          )}
          {loading && <Loader2 className="size-4 animate-spin" />}
          {data?.source === "sample" && <span className="text-amber-400">sample</span>}
          {data && !loading && (
            <span>
              {groups.length.toLocaleString()} group{groups.length === 1 ? "" : "s"} ·{" "}
              {data.duplicateTracks.toLocaleString()} tracks · scanned{" "}
              {data.scanned.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Groups */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Scanning library…
          </div>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No duplicates found with {match} matching.
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-24">
            {groups.map((g) => {
              const memberIds = g.members.map((m) => m.id);
              return (
                <div key={g.key} className="overflow-hidden rounded-lg border border-border">
                  <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {g.artist} — {g.title}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{g.members.length} copies</span>
                        {g.reclaimableBytes > 0 && (
                          <span>· {formatBytes(g.reclaimableBytes)} reclaimable</span>
                        )}
                        {g.versionsDiffer && (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="size-3" /> versions differ
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto shrink-0 text-xs"
                      onClick={() => selectOthers(memberIds)}
                    >
                      Select all but keeper
                    </Button>
                  </div>

                  <div className="divide-y divide-border/60">
                    {g.members.map((m, i) => {
                      const keeper = i === 0;
                      return (
                        <div
                          key={m.id}
                          data-selected={selected.has(m.id)}
                          className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm data-[selected=true]:bg-destructive/10"
                        >
                          <Checkbox
                            checked={selected.has(m.id)}
                            onCheckedChange={() => toggle(m.id)}
                            aria-label={`Select ${m.title}`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {keeper && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary">
                                  <Crown className="size-3" /> keep
                                </span>
                              )}
                              <span className="truncate text-muted-foreground" title={m.album}>
                                {m.album || "—"}
                              </span>
                            </div>
                            <div
                              className="truncate font-mono text-xs text-muted-foreground/70"
                              title={m.path}
                            >
                              {m.path ?? "no path"}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground tabular-nums">
                            <span title="quality">{quality(m)}</span>
                            <span title="plays" className="w-12 text-right">
                              {m.playCount} play{m.playCount === 1 ? "" : "s"}
                            </span>
                            <span title="added" className="w-16 text-right">
                              {relativeTime(m.createdAt, now)}
                            </span>
                            <span className="w-10 text-right">
                              {formatDuration(m.durationSecs)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium tabular-nums">{selected.size} to trash</span>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" /> Move to trash
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedSongs.length} duplicate(s) to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Files move to <code className="rounded bg-muted px-1">./trash</code> (recoverable),
              then Navidrome is rescanned. Keepers are untouched. Nothing is permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
            {selectedSongs.map((s) => (
              <div key={s.id} className="truncate py-0.5" title={s.path}>
                {s.path ?? <span className="text-red-400">no path — {s.title}</span>}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Moving…" : "Move to trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
