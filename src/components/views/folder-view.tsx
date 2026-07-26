"use client";

import {
  AlertTriangle,
  File,
  Folder,
  FolderPlus,
  Home,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderTree } from "@/components/views/folder-tree";
import { useFolder } from "@/hooks/use-folder";
import { formatBytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FolderEntry } from "@/lib/types";

type ConfirmAction = "trash" | "restore" | "destroy";

export function FolderView({ now }: { now: number }) {
  const {
    mode,
    setMode,
    tree,
    expanded,
    path,
    listing,
    loading,
    error,
    deleting,
    selected,
    navigate,
    toggleExpand,
    remove,
    restore,
    destroy,
    createFolder,
    rename,
    moveFile,
  } = useFolder();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>("trash");
  const [newFolderName, setNewFolderName] = useState<string | null>(null);

  const entries = listing?.entries ?? [];
  const selectedRels = [...selected.set];
  const rootDirs = tree[""] ?? [];
  const allVisibleSelected = entries.length > 0 && entries.every((e) => selected.set.has(e.rel));
  const isTrash = mode === "trash";

  function toggleAll() {
    if (allVisibleSelected) selected.clear();
    else for (const e of entries) if (!selected.set.has(e.rel)) selected.toggle(e.rel);
  }

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action);
    setConfirmOpen(true);
  }

  async function doConfirm() {
    if (confirmAction === "trash") await remove(selectedRels);
    else if (confirmAction === "restore") await restore(selectedRels);
    else await destroy(selectedRels);
    setConfirmOpen(false);
  }

  async function commitNewFolder() {
    const name = (newFolderName ?? "").trim();
    if (!name) {
      setNewFolderName(null);
      return;
    }
    await createFolder(path, name);
    setNewFolderName(null);
  }

  const confirmTitle = confirmLabel(confirmAction, selected.size);
  const confirmDesc = confirmDescription(confirmAction);

  return (
    <div className="flex h-full flex-col">
      <FolderToolbar isTrash={isTrash} setMode={setMode} onNewFolder={() => setNewFolderName("")} />

      {/* Split panes */}
      <div className="flex min-h-0 flex-1">
        {/* Tree pane — the folder sidebar; click a folder to show its content. */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-r border-border/50 md:block">
          <div className="sticky top-0 bg-sidebar px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isTrash ? "Trash" : "Folders"}
          </div>
          <button
            onClick={() => navigate("")}
            className={cn(
              "flex w-full items-center gap-1.5 px-3 py-1 text-sm transition-colors",
              path === ""
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "rounded-md text-muted-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Home className="size-3.5" />
            <span>{isTrash ? "Trash root" : "Music root"}</span>
          </button>
          <FolderTree
            rootDirs={rootDirs}
            expanded={expanded}
            childNodes={tree}
            currentPath={path}
            mode={mode}
            onToggleExpand={toggleExpand}
            onNavigate={navigate}
            onRename={rename}
            onDrop={moveFile}
          />
        </div>

        {/* Content pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Table */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-destructive">
                <AlertTriangle className="mr-2 size-4" />
                {error}
              </div>
            ) : entries.length === 0 && !newFolderName ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Empty directory
              </div>
            ) : (
              <div className="min-w-full">
                {/* Header row */}
                <div className="grid grid-cols-[1.5rem_2rem_1fr_10rem_9rem_7rem] items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:px-6">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                  <span />
                  <span>Name</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Modified</span>
                  <span className="text-right">{isTrash ? "Actions" : "Indexed"}</span>
                </div>
                {/* Parent dir link */}
                {listing?.parent != null && path !== "" && (
                  <button
                    onClick={() => navigate(listing.parent ?? "")}
                    className="grid w-full grid-cols-[1.5rem_2rem_1fr_10rem_9rem_7rem] items-center gap-2 border-b border-border/50 px-4 py-2 text-sm hover:bg-muted/40 sm:px-6"
                  >
                    <span />
                    <Folder className="size-4 text-muted-foreground" />
                    <span className="text-muted-foreground">..</span>
                    <span />
                    <span />
                    <span />
                  </button>
                )}
                {/* New folder input row */}
                {newFolderName !== null && (
                  <div className="grid grid-cols-[1.5rem_2rem_1fr_10rem_9rem_7rem] items-center gap-2 border-b border-border/50 bg-primary/5 px-4 py-2 text-sm sm:px-6">
                    <span />
                    <FolderPlus className="size-4 text-primary" />
                    <input
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onBlur={commitNewFolder}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitNewFolder();
                        if (e.key === "Escape") setNewFolderName(null);
                      }}
                      placeholder="Folder name…"
                      className="min-w-0 rounded border border-border bg-background px-2 py-1 text-sm"
                    />
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                {entries.map((e) => (
                  <FolderRow
                    key={e.rel}
                    entry={e}
                    now={now}
                    isTrash={isTrash}
                    selected={selected.set.has(e.rel)}
                    onToggle={() => selected.toggle(e.rel)}
                    onOpen={() => e.isDir && navigate(e.rel)}
                    onRestore={() => {
                      selected.clear();
                      selected.toggle(e.rel);
                      openConfirm("restore");
                    }}
                    onDestroy={() => {
                      selected.clear();
                      selected.toggle(e.rel);
                      openConfirm("destroy");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FolderBulkBar
        isTrash={isTrash}
        selectedSize={selected.size}
        openConfirm={openConfirm}
        clearSelection={() => selected.clear()}
      />

      <FolderConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        confirmAction={confirmAction}
        confirmTitle={confirmTitle}
        confirmDesc={confirmDesc}
        selectedRels={selectedRels}
        deleting={deleting}
        onConfirm={doConfirm}
      />
    </div>
  );
}

function confirmLabel(action: ConfirmAction, count: number): string {
  if (action === "trash") return `Move ${count} item(s) to trash?`;
  if (action === "restore") return `Restore ${count} item(s)?`;
  return `Permanently delete ${count} item(s)?`;
}

function confirmDescription(action: ConfirmAction): string {
  if (action === "trash") {
    return "Files and folders move to ./trash (recoverable), then Navidrome is rescanned. Directories move whole. Nothing is permanently deleted in v1.";
  }
  if (action === "restore") {
    return "Files move from ./trash back to their original ./music path, then Navidrome is rescanned.";
  }
  return "This permanently removes the files from ./trash. This action cannot be undone.";
}

function FolderRow({
  entry,
  now,
  isTrash,
  selected,
  onToggle,
  onOpen,
  onRestore,
  onDestroy,
}: {
  entry: FolderEntry;
  now: number;
  isTrash: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRestore: () => void;
  onDestroy: () => void;
}) {
  function handleDragStart(e: DragEvent) {
    if (!isTrash && !entry.isDir) {
      e.dataTransfer.setData("text/folder-rel", entry.rel);
      e.dataTransfer.effectAllowed = "move";
    }
  }

  return (
    <div
      data-selected={selected}
      draggable={!isTrash && !entry.isDir}
      onDragStart={handleDragStart}
      className="group grid w-full grid-cols-[1.5rem_2rem_1fr_10rem_9rem_7rem] items-center gap-2 border-b border-border/50 px-4 py-2 text-sm hover:bg-muted/40 data-[selected=true]:bg-primary/10 sm:px-6"
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${entry.name}`} />
      <button
        onClick={onOpen}
        className="flex items-center justify-center text-muted-foreground"
        aria-label={entry.isDir ? `Open ${entry.name}` : `Select ${entry.name}`}
      >
        {entry.isDir ? <Folder className="size-4 text-primary/80" /> : <File className="size-4" />}
      </button>
      <button
        onClick={onOpen}
        className="min-w-0 truncate text-left text-foreground hover:underline"
        title={entry.name}
      >
        {entry.name}
      </button>
      <span className="text-right tabular-nums text-muted-foreground">
        {entry.isDir ? "—" : formatBytes(entry.sizeBytes ?? 0)}
      </span>
      <span className="text-right text-muted-foreground">
        {relativeTime(entry.modifiedAt, now)}
      </span>
      <FolderActionsCell
        entry={entry}
        isTrash={isTrash}
        onRestore={onRestore}
        onDestroy={onDestroy}
      />
    </div>
  );
}

function FolderToolbar({
  isTrash,
  setMode,
  onNewFolder,
}: {
  isTrash: boolean;
  setMode: (m: "music" | "trash") => void;
  onNewFolder: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-2 sm:px-6">
      <div className="flex rounded-md border border-border">
        <button
          onClick={() => setMode("music")}
          className={cn(
            "rounded-l-md px-3 py-1 text-sm font-medium transition-colors",
            !isTrash
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Music
        </button>
        <button
          onClick={() => setMode("trash")}
          className={cn(
            "rounded-r-md px-3 py-1 text-sm font-medium transition-colors",
            isTrash
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Trash
        </button>
      </div>
      {!isTrash && (
        <Button size="sm" variant="outline" onClick={onNewFolder}>
          <FolderPlus className="size-4" /> New Folder
        </Button>
      )}
    </div>
  );
}

function FolderBulkBar({
  isTrash,
  selectedSize,
  openConfirm,
  clearSelection,
}: {
  isTrash: boolean;
  selectedSize: number;
  openConfirm: (a: "trash" | "restore" | "destroy") => void;
  clearSelection: () => void;
}) {
  if (selectedSize === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[var(--player-bar-offset,1.5rem)] flex justify-center transition-[bottom] duration-200">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
        <span className="px-2 text-sm font-medium tabular-nums">{selectedSize} selected</span>
        <div className="mx-1 h-5 w-px bg-border" />
        {isTrash ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-600 hover:text-emerald-600"
              onClick={() => openConfirm("restore")}
            >
              <RotateCcw className="size-4" /> Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => openConfirm("destroy")}
            >
              <X className="size-4" /> Delete forever
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => openConfirm("trash")}
          >
            <Trash2 className="size-4" /> Move to trash
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={clearSelection}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function FolderConfirmDialog({
  open,
  onOpenChange,
  confirmAction,
  confirmTitle,
  confirmDesc,
  selectedRels,
  deleting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  confirmAction: "trash" | "restore" | "destroy";
  confirmTitle: string;
  confirmDesc: string;
  selectedRels: string[];
  deleting: boolean;
  onConfirm: () => Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
          {selectedRels.map((rel) => (
            <div key={rel} className="truncate py-0.5" title={rel}>
              {rel}
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={deleting}
            className={cn(
              confirmAction === "destroy" && "bg-destructive text-white hover:bg-destructive/90",
              confirmAction === "trash" && "bg-destructive text-white hover:bg-destructive/90",
              confirmAction === "restore" && "bg-emerald-600 text-white hover:bg-emerald-600/90",
            )}
          >
            {deleting
              ? "Working\u2026"
              : confirmAction === "trash"
                ? "Move to trash"
                : confirmAction === "restore"
                  ? "Restore"
                  : "Delete forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FolderActionsCell({
  entry,
  isTrash,
  onRestore,
  onDestroy,
}: {
  entry: FolderEntry;
  isTrash: boolean;
  onRestore: () => void;
  onDestroy: () => void;
}) {
  if (isTrash) {
    return (
      <span className="flex items-center justify-end gap-1">
        <button
          onClick={onRestore}
          className="text-emerald-600 opacity-0 transition-opacity hover:text-emerald-700 group-hover:opacity-100"
          aria-label="Restore"
          title="Restore to original path"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          onClick={onDestroy}
          className="text-destructive opacity-0 transition-opacity hover:text-destructive/80 group-hover:opacity-100"
          aria-label="Delete permanently"
          title="Delete permanently"
        >
          <X className="size-3.5" />
        </button>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "text-right text-xs",
        entry.isDir
          ? "text-muted-foreground/40"
          : entry.indexed
            ? "text-emerald-500"
            : "text-amber-500",
      )}
      title={
        entry.isDir
          ? "Directories are not file entries"
          : entry.indexed
            ? "Indexed by Navidrome"
            : "Not in Navidrome's index"
      }
    >
      {entry.isDir ? "\u2014" : entry.indexed ? "indexed" : "unindexed"}
    </span>
  );
}
