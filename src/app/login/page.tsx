import { readdirSync } from "node:fs";
import { join } from "node:path";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPocketIdConfigured } from "@/lib/env";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Re-render per request so the background photo is re-picked on every reload.
export const dynamic = "force-dynamic";

const IMG_RE = /\.(jpe?g|png|webp|avif)$/i;

/** Pick a random image from public/login — drop files there to join the rotation. */
function pickLoginBackground(): string | null {
  let files: string[];
  try {
    files = readdirSync(join(process.cwd(), "public", "login")).filter((f) => IMG_RE.test(f));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  return `/login/${files[Math.floor(Math.random() * files.length)]}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect(safeNext(next));
  }

  const bg = pickLoginBackground();

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-6 sm:px-12 lg:px-20">
      {/* Random cover photo (public/login/*), tinted toward the brand and faded
          left-to-right so the form stays readable. Falls back to a green wash.
          Served directly (not next/image) so it paints immediately. */}
      {bg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/85 to-background/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary/25 via-transparent to-primary/10"
      />
      {!bg && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_12%_75%,rgba(34,197,94,0.22),transparent_70%)]"
        />
      )}

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Maestro</span>
        </div>
        <h1 className="mt-10 text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome back<span className="text-primary">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue.</p>
        <div className="mt-8">
          <LoginForm pocketIdEnabled={isPocketIdConfigured} next={safeNext(next)} />
        </div>
      </div>
    </div>
  );
}

/** Only allow same-origin relative redirects to avoid open-redirect abuse. */
function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}
