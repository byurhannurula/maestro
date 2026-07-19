"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Trigger a Navidrome scan (picks up new files, purges changed folders). */
export function ScanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
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
