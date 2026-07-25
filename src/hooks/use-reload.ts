"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/hooks/use-api";

export function useReload() {
  const router = useRouter();
  const [reloading, setReloading] = useState(false);

  const reload = useCallback(async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await apiPost("/api/reload");
    } catch {
      /* refresh anyway */
    }
    router.refresh();
    toast.success("Library reloaded");
    setReloading(false);
  }, [router, reloading]);

  return { reload, reloading };
}
