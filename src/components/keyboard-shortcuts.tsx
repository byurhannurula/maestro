"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  comboKeys,
  useRegisterShortcuts,
  useShortcutList,
  type ShortcutSpec,
} from "@/components/shortcuts";

/** Order groups appear in the help sheet. */
const GROUP_ORDER = ["Navigation", "View", "Actions", "Help"];

/**
 * Registers the app-wide global shortcuts (navigation, reload, theme, settings,
 * help) into the shortcut registry, and renders the `?` help sheet from the
 * live registry so any shortcut registered anywhere shows up automatically.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      await fetch("/api/reload", { method: "POST" });
    } catch {
      /* refresh anyway */
    }
    router.refresh();
    toast.success("Library reloaded");
  }, [router]);

  const specs: ShortcutSpec[] = [
    {
      id: "nav-all",
      combo: "g a",
      label: "All Songs",
      group: "Navigation",
      run: () => router.push("/"),
    },
    {
      id: "nav-playlists",
      combo: "g p",
      label: "Playlists",
      group: "Navigation",
      run: () => router.push("/playlists"),
    },
    {
      id: "nav-discovery",
      combo: "g d",
      label: "Discovery",
      group: "Navigation",
      run: () => router.push("/discovery"),
    },
    {
      id: "nav-cleanup",
      combo: "g c",
      label: "Cleanup",
      group: "Navigation",
      run: () => router.push("/cleanup"),
    },
    {
      id: "nav-import",
      combo: "g i",
      label: "Import",
      group: "Navigation",
      run: () => router.push("/import"),
    },
    {
      id: "nav-settings",
      combo: "g s",
      label: "Settings",
      group: "Navigation",
      run: () => router.push("/settings"),
    },
    {
      id: "open-settings",
      combo: "s",
      label: "Open Settings",
      group: "Navigation",
      run: () => router.push("/settings"),
    },
    {
      id: "open-settings-alt",
      combo: "mod+,",
      label: "Open Settings",
      group: "Actions",
      run: () => router.push("/settings"),
    },
    {
      id: "reload",
      combo: "r",
      label: "Reload library",
      group: "Actions",
      run: () => void reload(),
    },
    {
      id: "toggle-theme",
      combo: "d",
      label: "Toggle light / dark",
      group: "View",
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      id: "help",
      combo: "?",
      label: "Show this help",
      group: "Help",
      run: () => setHelpOpen((v) => !v),
    },
  ];
  useRegisterShortcuts(specs);

  // Esc closes the help sheet.
  useEffect(() => {
    if (!helpOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHelpOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen]);

  return <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />;
}

function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = useShortcutList();
  if (!open) return null;

  const groups = new Map<string, typeof list>();
  for (const s of list) {
    const g = s.group ?? "Other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }
  const orderedGroups = [...groups.keys()].sort(
    (a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Keyboard shortcuts
        </h2>
        <div className="flex flex-col gap-4">
          {orderedGroups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground/70">{g}</div>
              <ul className="flex flex-col gap-2">
                {groups.get(g)!.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 text-sm">
                    <span>{s.label}</span>
                    <span className="flex items-center gap-1">
                      {comboKeys(s.combo).map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Press Esc to close</p>
      </div>
    </div>
  );
}
