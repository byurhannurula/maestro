import "server-only";
import { env } from "@/lib/env";

/**
 * deemix webui REST client (bambanah/deemix).
 *
 * deemix ties the logged-in Deezer session to an express-session cookie
 * (`connect.sid`). Our server-to-server calls must therefore log in once with
 * the ARL and reuse the captured cookie, or downloads fail with `NotLoggedIn`.
 *
 * The app resolves each import line to a single TRACK url and queues that —
 * never a playlist url — to avoid deemix's per-playlist folder duplication.
 */

let sessionCookie: string | null = null;

function captureCookie(setCookie: string | null) {
  if (!setCookie) return;
  const m = /(connect\.sid=[^;]+)/.exec(setCookie);
  if (m) sessionCookie = m[1];
}

async function raw(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (sessionCookie) headers["cookie"] = sessionCookie;

  const res = await fetch(`${env.DEEMIX_URL}/api/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  captureCookie(res.headers.get("set-cookie"));
  return res;
}

async function getJson<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await raw("GET", `${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`deemix GET ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await raw("POST", path, body);
  if (!res.ok) throw new Error(`deemix POST ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

// --- session / auth -------------------------------------------------------

interface ConnectResponse {
  deezerAvailable?: boolean;
  spotifyEnabled?: boolean;
  currentUser?: { id?: number; name?: string } | null;
}

async function connect(): Promise<ConnectResponse> {
  return getJson<ConnectResponse>("connect");
}

/** Log in with the configured ARL, capturing the session cookie. */
export async function login(): Promise<boolean> {
  if (!env.DEEMIX_ARL) return false;
  const res = await raw("POST", "loginArl", { arl: env.DEEMIX_ARL });
  if (!res.ok) return false;
  const j = (await res.json().catch(() => null)) as { status?: number } | null;
  // 1 success, 2 already logged, 3 forced success.
  return j?.status === 1 || j?.status === 2 || j?.status === 3;
}

/** Ensure the current session has a logged-in Deezer account. */
export async function ensureLoggedIn(): Promise<boolean> {
  try {
    if ((await connect()).currentUser?.id) return true;
  } catch {
    /* fall through to login */
  }
  return login();
}

// --- status ---------------------------------------------------------------

export interface DeemixStatus {
  reachable: boolean;
  deezerAvailable: boolean;
  spotifyEnabled: boolean;
  loggedIn: boolean;
}

export async function status(): Promise<DeemixStatus> {
  try {
    const r = await connect();
    return {
      reachable: true,
      deezerAvailable: Boolean(r.deezerAvailable),
      spotifyEnabled: Boolean(r.spotifyEnabled),
      loggedIn: Boolean(r.currentUser?.id),
    };
  } catch {
    return { reachable: false, deezerAvailable: false, spotifyEnabled: false, loggedIn: false };
  }
}

// --- search ---------------------------------------------------------------

export interface DeezerTrack {
  id: number;
  title: string;
  artist: string;
  link: string;
}

interface RawSearchResult {
  data?: Array<{
    id: number;
    title: string;
    artist?: { name?: string };
    link?: string;
  }>;
}

export async function searchTrack(term: string, limit = 5): Promise<DeezerTrack[]> {
  const r = await getJson<RawSearchResult>("search", {
    term,
    type: "track",
    start: "0",
    nb: String(limit),
  });
  return (r.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    artist: t.artist?.name ?? "",
    link: t.link ?? `https://www.deezer.com/track/${t.id}`,
  }));
}

// --- queue / download -----------------------------------------------------

export interface AddToQueueResult {
  result: boolean;
  errid?: string;
  data?: { obj?: unknown };
}

/** Queue a Deezer track URL for download. Logs in first if needed. */
export async function addToQueue(url: string, bitrate = ""): Promise<AddToQueueResult> {
  await ensureLoggedIn();
  const res = await postJson<AddToQueueResult>("addToQueue", { url, bitrate });
  // deemix returns { result:false, errid:"NotLoggedIn" } if the session lapsed.
  if (!res.result && res.errid === "NotLoggedIn") {
    if (await login()) return postJson<AddToQueueResult>("addToQueue", { url, bitrate });
  }
  return res;
}

export interface QueueItem {
  uuid: string;
  title?: string;
  artist?: string;
  /** 0..100 download progress. */
  progress?: number;
  /** deemix marks finished items; shape varies, so we read several fields. */
  status?: string;
  downloaded?: number;
  failed?: number;
  size?: number;
}

export interface QueueState {
  queue: Record<string, QueueItem>;
  queueOrder: string[];
}

export async function getQueue(): Promise<QueueState> {
  return getJson<QueueState>("getQueue");
}
