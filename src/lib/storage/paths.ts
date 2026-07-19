import { isAbsolute, relative, resolve } from "node:path";

/**
 * Resolve a library-relative (or absolute-inside-root) path to an absolute path
 * under `root`, rejecting any traversal escape. Returns null if the input would
 * resolve outside `root`. Pure + `server-only`-free so it's unit-testable.
 */
export function safeRelPath(rel: string, root: string): string | null {
  let r = rel;
  if (isAbsolute(r)) {
    const asRel = relative(root, r);
    if (asRel.startsWith("..") || isAbsolute(asRel)) return null;
    r = asRel;
  }
  const abs = resolve(root, r);
  const back = relative(root, abs);
  if (back.startsWith("..") || isAbsolute(back)) return null;
  return abs;
}
