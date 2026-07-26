"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiJson, errMsg } from "@/hooks/use-api";
import { useToggleSet } from "@/hooks/use-toggle-set";
import type { FolderEntry, FolderListing } from "@/lib/types";

const FOLDER_API = "/api/folder";

export type FolderMode = "music" | "trash";

interface FolderState {
  /** Expanded dir rels → their directory-only children (lazy-loaded). */
  tree: Record<string, FolderEntry[]>;
  /** Which folder rels are expanded. */
  expanded: Set<string>;
  /** The currently selected folder rel ("" = root). */
  path: string;
  /** Full listing (files + dirs) of the current folder. */
  listing: FolderListing | null;
  loading: boolean;
  error: string | null;
}

const initialState: FolderState = {
  tree: {},
  expanded: new Set(),
  path: "",
  listing: null,
  loading: true,
  error: null,
};

function listUrl(p: string, m: FolderMode): string {
  const sp = new URLSearchParams();
  if (p) sp.set("path", p);
  if (m === "trash") sp.set("root", "trash");
  return `/api/folder?${sp.toString()}`;
}

function treeUrl(p: string, m: FolderMode): string {
  const sp = new URLSearchParams();
  if (p) sp.set("path", p);
  sp.set("dirsOnly", "1");
  if (m === "trash") sp.set("root", "trash");
  return `/api/folder?${sp.toString()}`;
}

/**
 * Music Folder Browser state (PRD §6.6). Manages a lazy-loaded directory tree
 * (dirsOnly) on the left + a full content listing on the right, with a music/
 * trash mode toggle. Handles: move-to-trash, restore, permanent-delete,
 * create-folder, rename, and drag-and-drop move-within-music.
 */
export function useFolder() {
  const [mode, setModeState] = useState<FolderMode>("music");
  const [state, setState] = useState<FolderState>(initialState);
  const selected = useToggleSet<string>();
  const [deleting, setDeleting] = useState(false);

  // Refs mirror state for use inside async callbacks without re-creating them.
  const expandedRef = useRef<Set<string>>(new Set());
  const pathRef = useRef("");
  expandedRef.current = state.expanded;
  pathRef.current = state.path;

  const loadContent = useCallback(async (p: string, m: FolderMode) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const listing = await apiJson<FolderListing>(listUrl(p, m));
      setState((s) => ({ ...s, listing, path: listing.path, loading: false }));
    } catch (e) {
      setState((s) => ({ ...s, listing: null, loading: false, error: errMsg(e) }));
    }
  }, []);

  // Load root on mount + whenever mode switches.
  useEffect(() => {
    setState({ ...initialState, loading: true });
    void loadContent("", mode);
    // Also lazy-load the root tree node.
    void (async () => {
      try {
        const data = await apiJson<FolderListing>(treeUrl("", mode));
        setState((s) => {
          const expanded = new Set(s.expanded);
          expanded.add("");
          return { ...s, tree: { ...s.tree, "": data.entries }, expanded };
        });
      } catch {
        /* ignore — tree stays empty */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const setMode = useCallback((m: FolderMode) => setModeState(m), []);

  const navigate = useCallback(
    (p: string) => {
      selected.clear();
      void loadContent(p, mode);
    },
    [loadContent, mode, selected],
  );

  const toggleExpand = useCallback(
    async (rel: string) => {
      const wasExpanded = expandedRef.current.has(rel);
      const willExpand = !wasExpanded;

      setState((s) => {
        const next = new Set(s.expanded);
        if (wasExpanded) next.delete(rel);
        else next.add(rel);
        return { ...s, expanded: next };
      });

      if (!willExpand) return;
      // Lazy-load children if not already cached.
      if (state.tree[rel]) return;
      try {
        const children = await apiJson<FolderListing>(treeUrl(rel, mode));
        setState((s) => ({ ...s, tree: { ...s.tree, [rel]: children.entries } }));
      } catch {
        /* leave node empty — user can collapse and retry */
      }
    },
    [mode, state.tree],
  );

  /** Reload the content pane + all expanded tree nodes (after a mutation). */
  const reloadAll = useCallback(async () => {
    await loadContent(pathRef.current, mode);
    const expanded = [...expandedRef.current];
    for (const rel of expanded) {
      try {
        const data = await apiJson<FolderListing>(treeUrl(rel, mode));
        setState((s) => ({ ...s, tree: { ...s.tree, [rel]: data.entries } }));
      } catch {
        /* ignore */
      }
    }
  }, [loadContent, mode]);

  async function remove(rels: string[]) {
    if (rels.length === 0) return;
    setDeleting(true);
    try {
      const data = await apiJson<{
        moved: number;
        failed: number;
        results: Array<{ path: string; ok?: boolean }>;
      }>(FOLDER_API, {
        method: "POST",
        body: JSON.stringify({ paths: rels }),
      });
      const failedNote = data.failed ? `, ${data.failed} failed` : "";
      toast.success(`Moved ${data.moved} to trash${failedNote}`);
      selected.clear();
      await reloadAll();
    } catch (e) {
      toast.error(`Move to trash failed: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  }

  async function restore(rels: string[]) {
    if (rels.length === 0) return;
    setDeleting(true);
    try {
      const data = await apiJson<{
        restored: number;
        failed: number;
        results: Array<{ path: string; ok?: boolean }>;
      }>("/api/folder/restore", {
        method: "POST",
        body: JSON.stringify({ paths: rels }),
      });
      const failedNote = data.failed ? `, ${data.failed} failed` : "";
      toast.success(`Restored ${data.restored}${failedNote}`);
      selected.clear();
      await reloadAll();
    } catch (e) {
      toast.error(`Restore failed: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  }

  async function destroy(rels: string[]) {
    if (rels.length === 0) return;
    setDeleting(true);
    try {
      const data = await apiJson<{
        deleted: number;
        failed: number;
        results: Array<{ path: string; ok?: boolean }>;
      }>(FOLDER_API, {
        method: "DELETE",
        body: JSON.stringify({ paths: rels }),
      });
      const failedNote = data.failed ? `, ${data.failed} failed` : "";
      toast.success(`Permanently deleted ${data.deleted}${failedNote}`);
      selected.clear();
      await reloadAll();
    } catch (e) {
      toast.error(`Delete failed: ${errMsg(e)}`);
    } finally {
      setDeleting(false);
    }
  }

  async function createFolder(parentRel: string, name: string) {
    try {
      await apiJson(FOLDER_API, {
        method: "PUT",
        body: JSON.stringify({ parent: parentRel, name }),
      });
      toast.success(`Created folder "${name}"`);
      await reloadAll();
    } catch (e) {
      toast.error(`Create folder failed: ${errMsg(e)}`);
    }
  }

  async function rename(rel: string, newName: string) {
    try {
      await apiJson(FOLDER_API, {
        method: "PATCH",
        body: JSON.stringify({ rel, newName }),
      });
      toast.success(`Renamed to "${newName}"`);
      await reloadAll();
    } catch (e) {
      toast.error(`Rename failed: ${errMsg(e)}`);
    }
  }

  async function moveFile(src: string, destDir: string) {
    try {
      await apiJson("/api/folder/move", {
        method: "POST",
        body: JSON.stringify({ src, destDir }),
      });
      toast.success(`Moved to ${destDir || "root"}`);
      await reloadAll();
    } catch (e) {
      toast.error(`Move failed: ${errMsg(e)}`);
    }
  }

  return {
    mode,
    setMode,
    tree: state.tree,
    expanded: state.expanded,
    path: state.path,
    listing: state.listing,
    loading: state.loading,
    error: state.error,
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
  };
}
