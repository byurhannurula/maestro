"use client";

import { toast } from "sonner";
import { apiPost } from "@/hooks/use-api";

export async function deleteToTrash(
  ids: string[],
): Promise<{ moved: number; failed: number; okIds: Set<string> } | null> {
  try {
    const data = await apiPost<{
      moved: number;
      failed: number;
      results: Array<{ id?: string; ok?: boolean }>;
    }>("/api/delete", { ids });
    const okIds = new Set(
      (data.results ?? []).filter((r) => r.ok && r.id).map((r) => r.id as string),
    );
    const failedNote = data.failed ? `, ${data.failed} failed` : "";
    toast.success(`Moved ${data.moved} to trash${failedNote}`);
    return { moved: data.moved, failed: data.failed, okIds };
  } catch (e) {
    toast.error(`Delete failed: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
