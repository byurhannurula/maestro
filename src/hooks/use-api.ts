import { errMsg } from "@/lib/utils";

/**
 * Client fetch helper: does the `!res.ok → throw` + JSON parse every mutation
 * repeated by hand, surfacing the server's `{ error }` message when present.
 * Callers keep only their success/toast logic.
 */
export async function apiJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json", ...init?.headers }
        : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** POST JSON and return the parsed response. */
export function apiPost<T = unknown>(url: string, body?: unknown): Promise<T> {
  return apiJson<T>(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export { errMsg };
