"use client";

import {
  ChevronsUpDown,
  Download,
  FolderOpen,
  ListMusic,
  ListVideo,
  Loader2,
  LogOut,
  PanelLeft,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { Logo } from "@/components/logo";
import { ScrollingText } from "@/components/scrolling-text";
import { useShortcut, useShortcutHint } from "@/components/shortcuts";
import { useSidebar } from "@/components/sidebar-provider";
import { ThemeMenuSub } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreatePlaylist } from "@/hooks/use-create-playlist";
import { useReload } from "@/hooks/use-reload";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import type { Playlist } from "@/lib/types";

const NAV = [
  { href: "/", label: "All Songs", icon: ListMusic, exact: true },
  { href: "/playlists", label: "Playlists", icon: ListVideo, exact: false },
  { href: "/discovery", label: "Discovery", icon: Sparkles, exact: false },
  { href: "/cleanup", label: "Cleanup", icon: Trash2, exact: false },
  { href: "/folders", label: "Folders", icon: FolderOpen, exact: false },
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

export function AppSidebar({ playlists, username }: { playlists: Playlist[]; username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle, setCollapsed } = useSidebar();
  const { reload: reloadLibrary, reloading } = useReload();
  const createPlaylist = useCreatePlaylist();
  const settingsHint = useShortcutHint("open-settings");
  const reloadHint = useShortcutHint("reload");

  // On mobile the sidebar is an overlay, so close it after navigating.
  const closeOnMobile = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setCollapsed(true);
  }, [setCollapsed]);

  useShortcut({
    id: "toggle-sidebar",
    combo: "mod+b",
    label: "Toggle sidebar",
    group: "View",
    allowInInput: true,
    run: toggle,
  });

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/login");
  }

  return (
    <>
      {/* Mobile-only backdrop: tap to close the overlay drawer. */}
      {!collapsed && (
        <button
          aria-label="Close sidebar"
          onClick={() => setCollapsed(true)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <aside
        className={cn(
          // Mobile: fixed overlay drawer that slides in/out. Desktop (md+):
          // inline column whose width animates between 0 and 18rem.
          "fixed inset-y-0 left-0 z-40 h-full w-72 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 ease-in-out md:static md:z-auto",
          collapsed ? "-translate-x-full md:w-0 md:translate-x-0 md:border-r-0" : "translate-x-0",
        )}
      >
        <div className="flex h-full w-72 flex-col bg-sidebar">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <Logo size={32} />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-sidebar-foreground">Maestro</div>
              <div className="text-xs text-muted-foreground">library manager</div>
            </div>
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar (⌘/Ctrl+B)"
              className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
            >
              <PanelLeft className="size-4" />
            </button>
          </div>

          <nav className="flex flex-col gap-1 px-3">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeOnMobile}
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
              <div className="flex items-center gap-1">
                <button
                  onClick={reloadLibrary}
                  disabled={reloading}
                  aria-label="Reload library"
                  title="Reload library"
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={cn("size-4", reloading && "animate-spin")} />
                </button>
                <button
                  onClick={() => void createPlaylist()}
                  aria-label="New playlist"
                  title="New playlist"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              <Suspense
                fallback={
                  <PlaylistLinks playlists={playlists} activeId={null} onNavigate={closeOnMobile} />
                }
              >
                <SelectedPlaylistLinks playlists={playlists} onNavigate={closeOnMobile} />
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
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="size-4" /> Settings
                    {settingsHint && <DropdownMenuShortcut>{settingsHint}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={reloadLibrary}>
                    <RefreshCw className="size-4" /> Reload library
                    {reloadHint && <DropdownMenuShortcut>{reloadHint}</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                  <ThemeMenuSub />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>
    </>
  );
}

function SelectedPlaylistLinks({
  playlists,
  onNavigate,
}: {
  playlists: Playlist[];
  onNavigate?: () => void;
}) {
  const activeId = useSearchParams().get("playlist");
  return <PlaylistLinks playlists={playlists} activeId={activeId} onNavigate={onNavigate} />;
}

function PlaylistLinks({
  playlists,
  activeId,
  onNavigate,
}: {
  playlists: Playlist[];
  activeId: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {playlists.map((pl) => (
        <Link
          key={pl.id}
          href={`/?playlist=${encodeURIComponent(pl.id)}`}
          onClick={onNavigate}
          className={cn(rowClass, activeId === pl.id ? activeClass : idleClass)}
        >
          <ListVideo className="size-4 shrink-0" />
          <ScrollingText text={pl.name} className="min-w-0 flex-1" />
          <LinkSpinner />
          <span className="ml-auto shrink-0 text-xs tabular-nums opacity-60">{pl.songCount}</span>
        </Link>
      ))}
    </div>
  );
}
