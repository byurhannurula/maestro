"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdaptivePoll } from "@/hooks/use-adaptive-poll";
import { apiJson, apiPost } from "@/hooks/use-api";
import { useToggleSet } from "@/hooks/use-toggle-set";
import { isFailed, summarize, type Filter } from "@/lib/import/summarize";
import type { ImportBatch } from "@/lib/import/store";

const IMPORT_URL = "/api/import";

export function useImportBatches() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const expanded = useToggleSet<string>();
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<
    { kind: "batch"; id: string; label: string } | { kind: "clear"; count: number } | null
  >(null);

  const active = batches.filter((b) => !b.done);
  const finished = batches.filter((b) => b.done);

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

  useAdaptivePoll(refresh, 1500, 6000);

  async function submit(body: {
    text: string;
    playlistId?: string;
    playlistName?: string;
  }): Promise<string> {
    const data = await apiPost<{ batchId: string }>(IMPORT_URL, body);
    expanded.setSet((prev) => new Set(prev).add(data.batchId));
    await refresh();
    return data.batchId;
  }

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
    expanded.toggle(id);
  }

  return {
    batches,
    setBatches,
    active,
    finished,
    visibleFinished,
    stats,
    filter,
    setFilter,
    expanded,
    confirm,
    setConfirm,
    refresh,
    submit,
    retry,
    resolve,
    doConfirm,
    toggle,
  };
}
