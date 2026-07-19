"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** `g`-then-key jump targets. */
const NAV_KEYS: Record<string, string> = {
  a: "/",
  p: "/playlists",
  d: "/discovery",
  c: "/cleanup",
  i: "/import",
  s: "/settings",
};

const HELP: { keys: string[]; label: string }[] = [
  { keys: ["g", "a"], label: "All Songs" },
  { keys: ["g", "p"], label: "Playlists" },
  { keys: ["g", "d"], label: "Discovery" },
  { keys: ["g", "c"], label: "Cleanup" },
  { keys: ["g", "i"], label: "Import" },
  { keys: ["g", "s"], label: "Settings" },
  { keys: ["⌘/Ctrl", ","], label: "Open Settings" },
  { keys: ["r"], label: "Reload library" },
  { keys: ["?"], label: "Show this help" },
];

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/**
 * App-wide keyboard shortcuts. Mounted once in the authed layout. Ignores
 * keystrokes while typing in a field. Leader key `g` then a letter navigates.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const leader = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      await fetch("/api/reload", { method: "POST" });
    } catch {
      /* refresh anyway */
    }
    router.refresh();
    toast.success("Library reloaded");
  }, [router]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setHelpOpen(false);
        leader.current = false;
        return;
      }
      if (isTyping(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (leader.current) {
        leader.current = false;
        if (timer.current) clearTimeout(timer.current);
        const dest = NAV_KEYS[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "g") {
        leader.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          leader.current = false;
        }, 1500);
      } else if (k === "r") {
        e.preventDefault();
        void reload();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, reload]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Keyboard shortcuts
        </h2>
        <ul className="flex flex-col gap-2">
          {HELP.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 text-sm">
              <span>{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
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
        <p className="mt-4 text-center text-xs text-muted-foreground">Press Esc to close</p>
      </div>
    </div>
  );
}
