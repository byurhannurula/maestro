import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate (Next 16 "proxy", formerly middleware). This only checks
 * for the presence of a session cookie — it does NOT validate it against the
 * database. Real enforcement lives in the `(app)` layout (server-side
 * `auth.api.getSession`) and in each mutating route handler (`requireSession`).
 *
 * Missing cookie: pages redirect to `/login`; API routes get a 401. The matcher
 * excludes `/api/auth/*` (better-auth's own endpoints), `/api/webhook/*`
 * (machine-to-machine, authed by its own secret), Next internals, and `/login`.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (sessionCookie) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Exclude better-auth + webhook endpoints, Next internals, the login page, and
  // the public PWA assets (manifest, icons, logo/wordmark) so they load without a
  // session — otherwise install prompts and favicons break on the login screen.
  matcher: [
    "/((?!api/auth|api/webhook|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|logo|wordmark|login).*)",
  ],
};
