import "server-only";
import { env } from "./env";

/**
 * Small in-process TTL cache for Navidrome reads. A single long-running server
 * owns it, so a plain Map is enough — no external store, no Next data-cache API
 * churn. Entries carry tags; `bust(tag)` drops all entries with that tag so a
 * user's own mutation shows immediately instead of waiting out the TTL.
 * Errors from the loader propagate uncached (a transient outage never sticks).
 */

type Tag = "songs" | "playlists";

interface Entry {
  value: unknown;
  expires: number;
  tags: Tag[];
}

const g = globalThis as unknown as { __maestroCache?: Map<string, Entry> };
g.__maestroCache ??= new Map();
const store = g.__maestroCache;

const TTL_MS = env.CACHE_TTL_SECONDS * 1000;

export async function cached<T>(key: string, tags: Tag[], loader: () => Promise<T>): Promise<T> {
  if (TTL_MS <= 0) return loader();
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await loader();
  store.set(key, { value, expires: Date.now() + TTL_MS, tags });
  return value;
}

export function bust(...tags: Tag[]): void {
  for (const [key, entry] of store) {
    if (entry.tags.some((t) => tags.includes(t))) store.delete(key);
  }
}
