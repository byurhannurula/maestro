"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

/** Trigger a Navidrome scan (picks up new files, purges changed folders). */
export function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    try {
      const data = await apiPost<{ scanning?: boolean }>("/api/scan");
      toast.success(data.scanning ? "Scan in progress…" : "Scan triggered");
      router.refresh();
    } catch (e) {
      toast.error(`Scan failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={scan}>
      <RefreshCw className={cn("size-4", busy && "animate-spin")} /> Scan now
    </Button>
  );
}
