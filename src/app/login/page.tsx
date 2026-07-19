import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPocketIdConfigured } from "@/lib/env";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

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

  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginForm pocketIdEnabled={isPocketIdConfigured} next={safeNext(next)} />
    </div>
  );
}

/** Only allow same-origin relative redirects to avoid open-redirect abuse. */
function safeNext(next?: string): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}
