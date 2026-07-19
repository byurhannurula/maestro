"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * App-wide keyboard-shortcut registry. A single window listener dispatches to
 * shortcuts registered (declaratively) by any component via `useShortcut` /
 * `useRegisterShortcuts`. Supports plain keys ("d"), modifier combos ("mod+b",
 * where `mod` is ⌘ on macOS / Ctrl elsewhere) and two-key leader sequences
 * ("g a"). The `?` help sheet is rendered from the live registry, so a new
 * shortcut shows up in help automatically.
 */

export interface ShortcutSpec {
  /** Stable unique id (used for register/unregister). */
  id: string;
  /** "mod+b" | "d" | "g a" | "?" | "mod+,". Space = leader sequence. */
  combo: string;
  /** Human label for the help sheet. */
  label: string;
  /** Help section, e.g. "Navigation" | "View" | "Actions". */
  group?: string;
  run: (e: KeyboardEvent) => void;
  /** Fire even while typing in an input (default false). */
  allowInInput?: boolean;
  /** preventDefault on match (default true). */
  preventDefault?: boolean;
}

interface Registry {
  register: (s: ShortcutSpec) => void;
  unregister: (id: string) => void;
}

// Split contexts: the registry is stable (hooks depend on it without churn);
// the list changes on every (un)registration and only drives the help sheet.
const RegistryContext = createContext<Registry | null>(null);
const ListContext = createContext<ShortcutSpec[]>([]);

const LEADER_TIMEOUT_MS = 1500;

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function parseToken(token: string) {
  const parts = token.split("+");
  const key = (parts.pop() ?? "").toLowerCase();
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  return { key, mod: mods.has("mod"), shift: mods.has("shift"), alt: mods.has("alt") };
}

/** Does a single token (e.g. "mod+b") match this event? */
function matchToken(e: KeyboardEvent, token: string): boolean {
  const t = parseToken(token);
  const modDown = e.metaKey || e.ctrlKey;
  if (t.mod !== modDown) return false;
  if (t.alt !== e.altKey) return false;
  // Shift is only enforced when explicitly requested; symbols like "?" already
  // encode it in e.key.
  if (t.shift && !e.shiftKey) return false;
  return e.key.toLowerCase() === t.key;
}

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const map = useRef(new Map<string, ShortcutSpec>());
  const [list, setList] = useState<ShortcutSpec[]>([]);
  const leader = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // register/unregister mutate the ref (read live by the key handler) and mirror
  // it into `list` state for the help sheet. Stable identities → no re-register.
  const register = useCallback((s: ShortcutSpec) => {
    map.current.set(s.id, s);
    setList([...map.current.values()]);
  }, []);
  const unregister = useCallback((id: string) => {
    map.current.delete(id);
    setList([...map.current.values()]);
  }, []);

  useEffect(() => {
    function clearLeader() {
      leader.current = null;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        clearLeader();
        return;
      }
      const specs = [...map.current.values()];

      // Second key of a leader sequence.
      if (leader.current) {
        const lead = leader.current;
        clearLeader();
        if (isTyping(e.target)) return;
        for (const s of specs) {
          const tokens = s.combo.split(" ");
          if (tokens.length === 2 && tokens[0].toLowerCase() === lead && matchToken(e, tokens[1])) {
            if (s.preventDefault !== false) e.preventDefault();
            s.run(e);
            return;
          }
        }
        return;
      }

      const typing = isTyping(e.target);

      // Single-token shortcuts.
      for (const s of specs) {
        const tokens = s.combo.split(" ");
        if (tokens.length !== 1) continue;
        if (typing && !s.allowInInput) continue;
        if (matchToken(e, tokens[0])) {
          if (s.preventDefault !== false) e.preventDefault();
          s.run(e);
          return;
        }
      }

      // Start a leader sequence if this key opens one.
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const leaders = new Set(
          specs
            .map((s) => s.combo.split(" "))
            .filter((t) => t.length === 2)
            .map((t) => t[0].toLowerCase()),
        );
        if (leaders.has(e.key.toLowerCase())) {
          leader.current = e.key.toLowerCase();
          timer.current = setTimeout(clearLeader, LEADER_TIMEOUT_MS);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const registry = useMemo<Registry>(() => ({ register, unregister }), [register, unregister]);

  return (
    <RegistryContext.Provider value={registry}>
      <ListContext.Provider value={list}>{children}</ListContext.Provider>
    </RegistryContext.Provider>
  );
}

/** Register a single shortcut; pass `null` to register nothing (e.g. when disabled). */
export function useShortcut(spec: ShortcutSpec | null) {
  const ctx = useContext(RegistryContext);
  const runRef = useRef(spec?.run);
  useEffect(() => {
    runRef.current = spec?.run;
  });

  const id = spec?.id;
  const combo = spec?.combo;
  const label = spec?.label;
  const group = spec?.group;
  const allowInInput = spec?.allowInInput;
  const preventDefault = spec?.preventDefault;

  useEffect(() => {
    if (!ctx || !id || !combo) return;
    ctx.register({
      id,
      combo,
      label: label ?? "",
      group,
      allowInInput,
      preventDefault,
      run: (e) => runRef.current?.(e),
    });
    return () => ctx.unregister(id);
  }, [ctx, id, combo, label, group, allowInInput, preventDefault]);
}

/** Register a static array of shortcuts (their `run` closures stay fresh). */
export function useRegisterShortcuts(specs: ShortcutSpec[]) {
  const ctx = useContext(RegistryContext);
  const ref = useRef(specs);
  useEffect(() => {
    ref.current = specs;
  });
  const key = specs.map((s) => `${s.id}:${s.combo}`).join("|");

  useEffect(() => {
    if (!ctx) return;
    const registered = ref.current.map((s) => s.id);
    ref.current.forEach((s, i) => ctx.register({ ...s, run: (e) => ref.current[i]?.run(e) }));
    return () => registered.forEach((id) => ctx.unregister(id));
  }, [ctx, key]);
}

/** Live list of registered shortcuts, for the help sheet. */
export function useShortcutList(): ShortcutSpec[] {
  return useContext(ListContext);
}

/** Render a combo as display keys: "mod+b" → ["⌘/Ctrl", "B"], "g a" → ["G", "A"]. */
export function comboKeys(combo: string): string[] {
  return combo.split(" ").flatMap((token) =>
    token.split("+").map((p) => {
      const l = p.toLowerCase();
      if (l === "mod") return "⌘/Ctrl";
      if (l === "shift") return "⇧";
      if (l === "alt") return "⌥";
      return p.length === 1 ? p.toUpperCase() : p;
    }),
  );
}
