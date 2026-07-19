import "server-only";

/**
 * Shared outbound HTTP helpers for the server-side API clients (ListenBrainz,
 * Deezer, Last.fm, …). Owns the repeated `no-store` + `accept: json` + `!res.ok
 * → throw` boilerplate so each client only describes its endpoints.
 */

/** Strip a trailing slash from a base URL. */
export const trimSlash = (url: string) => url.replace(/\/$/, "");

/** Label for error messages: the host, or the given fallback. */
function label(url: string | URL): string {
  try {
    return new URL(String(url)).host;
  } catch {
    return "request";
  }
}

export async function getJson<T>(url: string | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { accept: "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${label(url)} ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postJson<T>(
  url: string | URL,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
    headers: { "content-type": "application/json", accept: "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`${label(url)} ${res.status}`);
  return res.json() as Promise<T>;
}
