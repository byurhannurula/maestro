"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { view: "", label: "Never played" },
  { view: "duplicates", label: "Duplicates" },
];

/** Segmented toggle between the two Cleanup modes (via the `?view=` param). */
export function CleanupTabs() {
  const active = useSearchParams().get("view") ?? "";
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {TABS.map((t) => {
        const on = active === t.view;
        return (
          <Link
            key={t.view}
            href={t.view ? `/cleanup?view=${t.view}` : "/cleanup"}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
