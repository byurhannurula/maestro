"use client";

import { Suspense } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronsUpDown,
  Download,
  ListMusic,
  ListVideo,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import type { Playlist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/", label: "All Songs", icon: ListMusic, exact: true },
  { href: "/playlists", label: "Playlists", icon: ListVideo, exact: false },
  { href: "/discovery", label: "Discovery", icon: Sparkles, exact: false },
  { href: "/cleanup", label: "Cleanup", icon: Trash2, exact: false },
  { href: "/import", label: "Import", icon: Download, exact: false },
] as const;

const rowClass = "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors";
const activeClass = "bg-sidebar-accent text-sidebar-accent-foreground";
const idleClass = "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground";

/** Spinner that lights up while its parent <Link> navigation is pending. */
function LinkSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null;
}

export function AppSidebar({
  playlists,
  username,
}: {
  playlists: Playlist[];
  username: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  async function reloadLibrary() {
    try {
      await fetch("/api/reload", { method: "POST" });
    } catch {
      /* refresh anyway */
    }
    router.refresh();
    toast.success("Library reloaded");
  }

  async function createPlaylist() {
    const name = window.prompt("New playlist name")?.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Created "${name}"`);
      router.refresh();
    } catch (e) {
      toast.error(`Create failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={32} />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-sidebar-foreground">Maestro</div>
          <div className="text-xs text-muted-foreground">library manager</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(rowClass, "font-medium", active ? activeClass : idleClass)}
            >
              <Icon className="size-4" />
              {label}
              <LinkSpinner />
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Playlists
          </span>
          <button
            onClick={createPlaylist}
            aria-label="New playlist"
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <Suspense fallback={<PlaylistLinks playlists={playlists} activeId={null} />}>
            <SelectedPlaylistLinks playlists={playlists} />
          </Suspense>
        </div>
      </div>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-sidebar-accent/60">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {(username || "M").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-sidebar-foreground">
                {username || "Maestro"}
              </div>
              <div className="truncate text-xs text-muted-foreground">organiser</div>
            </div>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Signed in as {username || "admin"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/system")}>
                <Settings className="size-4" /> System
              </DropdownMenuItem>
              <DropdownMenuItem onClick={reloadLibrary}>
                <RefreshCw className="size-4" /> Reload library
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

function SelectedPlaylistLinks({ playlists }: { playlists: Playlist[] }) {
  const activeId = useSearchParams().get("playlist");
  return <PlaylistLinks playlists={playlists} activeId={activeId} />;
}

function PlaylistLinks({ playlists, activeId }: { playlists: Playlist[]; activeId: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      {playlists.map((pl) => (
        <Link
          key={pl.id}
          href={`/?playlist=${encodeURIComponent(pl.id)}`}
          className={cn(rowClass, activeId === pl.id ? activeClass : idleClass)}
        >
          <ListVideo className="size-4 shrink-0" />
          <span className="truncate">{pl.name}</span>
          <LinkSpinner />
          <span className="ml-auto shrink-0 text-xs tabular-nums opacity-60">{pl.songCount}</span>
        </Link>
      ))}
    </div>
  );
}
