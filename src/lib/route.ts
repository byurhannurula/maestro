import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { isNavidromeConfigured } from "@/lib/env";
import { errMsg } from "@/lib/utils";

/**
 * Shared helpers for API route handlers. `withSession` folds the session gate +
 * error handling every handler repeats; `jsonError` / `readJson` /
 * `requireNavidrome` cover the other copy-pasted lines.
 */

type Session = NonNullable<Awaited<ReturnType<typeof requireSession>>["session"]>;
type Handler<C> = (req: NextRequest, ctx: C, session: Session) => Promise<Response> | Response;

/** Gate a handler behind a valid session; unhandled throws become a 500. */
export function withSession<C = unknown>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const gate = await requireSession(req.headers);
    if (gate.response) return gate.response;
    try {
      return await handler(req, ctx, gate.session);
    } catch (e) {
      return jsonError(errMsg(e), 500);
    }
  };
}

export function jsonError(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status });
}

/** Parse a JSON body, tolerating an empty/invalid one. */
export async function readJson<T = Record<string, unknown>>(req: NextRequest): Promise<Partial<T>> {
  return (await req.json().catch(() => ({}))) as Partial<T>;
}

/** Returns a 400 response when Navidrome isn't configured, else null. */
export function requireNavidrome(): NextResponse | null {
  return isNavidromeConfigured ? null : jsonError("Navidrome not configured", 400);
}
