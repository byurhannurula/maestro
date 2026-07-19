import { useCallback, useMemo, useState } from "react";

/** A `Set` with a stable `toggle`/`clear` — the selection/queue pattern reused
 *  across the discovery, import and duplicates lists. */
export function useToggleSet<T>(initial?: Iterable<T>) {
  const [set, setSet] = useState<Set<T>>(() => new Set(initial));

  const toggle = useCallback((v: T) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSet(new Set()), []);

  return useMemo(() => ({ set, setSet, toggle, clear, size: set.size }), [set, toggle, clear]);
}
