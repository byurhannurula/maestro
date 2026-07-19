"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ pocketIdEnabled, next }: { pocketIdEnabled: boolean; next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"email" | "pocketid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending("email");
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: next,
    });
    if (error) {
      setError(error.message || "Sign in failed");
      setPending(null);
    } else {
      window.location.assign(next);
    }
  }

  async function onPocketId() {
    setError(null);
    setPending("pocketid");
    const { error } = await authClient.signIn.oauth2({
      providerId: "pocketid",
      callbackURL: next,
    });
    // On success the browser is redirected to PocketID, so this only runs on error.
    if (error) {
      setError(error.message || "PocketID sign in failed");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {pocketIdEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={onPocketId}
            disabled={pending !== null}
          >
            {pending === "pocketid" && <Loader2 className="size-4 animate-spin" />}
            Continue with PocketID
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <Input
          id="email"
          type="email"
          placeholder="Email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <Input
          id="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending !== null}>
          {pending === "email" && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </div>
  );
}
