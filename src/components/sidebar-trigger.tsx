"use client";

import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/sidebar-provider";

/**
 * Re-opens / toggles the sidebar from a page header. Always visible on mobile
 * (the only way to open the overlay drawer); on desktop it only appears when
 * the sidebar is collapsed, since the open sidebar carries its own collapse
 * button. Drop it into any header surface.
 */
export function SidebarTrigger({ className }: { className?: string }) {
  const { collapsed, toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle sidebar"
      title="Toggle sidebar (⌘/Ctrl+B)"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        collapsed ? "md:inline-flex" : "md:hidden",
        className,
      )}
    >
      <PanelLeft className="size-4" />
    </button>
  );
}
