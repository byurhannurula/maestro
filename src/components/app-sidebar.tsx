"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Download, ListMusic, ListVideo, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "All Songs", icon: ListMusic, exact: true },
  { href: "/import", label: "Import", icon: Download, exact: false },
  { href: "/playlists", label: "Playlists", icon: ListVideo, exact: false },
  { href: "/cleanup", label: "Cleanup", icon: Trash2, exact: false },
  { href: "/system", label: "System", icon: Activity, exact: false },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ListMusic className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">Navi Organiser</div>
          <div className="text-xs text-muted-foreground">library manager</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-xs text-muted-foreground">
        Player? Use Feishin. This is for organising.
      </div>
    </aside>
  );
}
