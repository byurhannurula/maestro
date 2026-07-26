"use client";

import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import type { FolderEntry } from "@/lib/types";

interface TreeNodeProps {
  entry: FolderEntry;
  depth: number;
  expanded: Set<string>;
  childNodes: Record<string, FolderEntry[]>;
  currentPath: string;
  mode: "music" | "trash";
  onToggleExpand: (rel: string) => void;
  onNavigate: (rel: string) => void;
  onRename: (rel: string, newName: string) => Promise<void>;
  onDrop: (srcRel: string, destDir: string) => Promise<void>;
}

export function FolderTreeNode(props: TreeNodeProps) {
  const {
    entry,
    depth,
    expanded,
    childNodes,
    currentPath,
    mode,
    onToggleExpand,
    onNavigate,
    onRename,
    onDrop,
  } = props;
  const isExpanded = expanded.has(entry.rel);
  const isActive = currentPath === entry.rel;
  const childDirs = childNodes[entry.rel] ?? [];
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(entry.name);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const src = e.dataTransfer.getData("text/folder-rel");
    if (src && src !== entry.rel) {
      void onDrop(src, entry.rel);
    }
  }

  function handleNavigateExpand() {
    onNavigate(entry.rel);
    if (!isExpanded) onToggleExpand(entry.rel);
  }

  async function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== entry.name) {
      await onRename(entry.rel, trimmed);
    }
    setRenaming(false);
  }

  return (
    <div>
      <div
        data-active={isActive}
        onDragOver={
          mode === "music"
            ? (e) => {
                e.preventDefault();
                setDragOver(true);
              }
            : undefined
        }
        onDragLeave={() => setDragOver(false)}
        onDrop={mode === "music" ? handleDrop : undefined}
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          dragOver && "ring-2 ring-primary ring-inset",
        )}
        style={{ paddingLeft: `${depth + 0.5}rem` }}
      >
        <button
          onClick={() => onToggleExpand(entry.rel)}
          className="flex size-4 shrink-0 items-center justify-center"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
        <button
          onClick={handleNavigateExpand}
          className="flex shrink-0 items-center"
          aria-label={`Open ${entry.name}`}
        >
          {isExpanded ? (
            <FolderOpen className="size-4 text-primary/80" />
          ) : (
            <Folder className="size-4 text-primary/80" />
          )}
        </button>
        <RenameableLabel
          renaming={renaming}
          name={name}
          entryName={entry.name}
          mode={mode}
          onEditStart={() => setRenaming(true)}
          onNameChange={setName}
          onCancel={() => {
            setName(entry.name);
            setRenaming(false);
          }}
          onCommit={commitRename}
          onNavigateExpand={handleNavigateExpand}
        />
      </div>
      {isExpanded && childDirs.length > 0 && (
        <div>
          {childDirs.map((child) => (
            <FolderTreeNode key={child.rel} {...props} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function RenameableLabel({
  renaming,
  name,
  entryName,
  mode,
  onEditStart,
  onNameChange,
  onCancel,
  onCommit,
  onNavigateExpand,
}: {
  renaming: boolean;
  name: string;
  entryName: string;
  mode: "music" | "trash";
  onEditStart: () => void;
  onNameChange: (v: string) => void;
  onCancel: () => void;
  onCommit: () => Promise<void>;
  onNavigateExpand: () => void;
}) {
  if (renaming) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") void onCommit();
          if (e.key === "Escape") onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        className="min-w-0 flex-1 rounded border border-border bg-background px-1 py-0 text-sm"
      />
    );
  }
  return (
    <button
      onClick={onNavigateExpand}
      onDoubleClick={() => mode === "music" && onEditStart()}
      className="min-w-0 flex-1 truncate text-left"
      title={mode === "music" ? `${entryName} (double-click to rename)` : entryName}
    >
      {entryName}
    </button>
  );
}

interface FolderTreeProps {
  rootDirs: FolderEntry[];
  expanded: Set<string>;
  childNodes: Record<string, FolderEntry[]>;
  currentPath: string;
  mode: "music" | "trash";
  onToggleExpand: (rel: string) => void;
  onNavigate: (rel: string) => void;
  onRename: (rel: string, newName: string) => Promise<void>;
  onDrop: (srcRel: string, destDir: string) => Promise<void>;
}

export function FolderTree({
  rootDirs,
  expanded,
  childNodes,
  currentPath,
  mode,
  onToggleExpand,
  onNavigate,
  onRename,
  onDrop,
}: FolderTreeProps) {
  if (rootDirs.length === 0) {
    return <div className="px-3 py-2 text-xs text-muted-foreground/60">No folders</div>;
  }
  return (
    <div className="py-1">
      {rootDirs.map((dir) => (
        <FolderTreeNode
          key={dir.rel}
          entry={dir}
          depth={0}
          expanded={expanded}
          childNodes={childNodes}
          currentPath={currentPath}
          mode={mode}
          onToggleExpand={onToggleExpand}
          onNavigate={onNavigate}
          onRename={onRename}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}
