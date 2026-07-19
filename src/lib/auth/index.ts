import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { env, isPocketIdConfigured } from "@/lib/env";

// During `next build` route modules are imported to collect metadata, but the
// /data volume isn't mounted yet — use a throwaway in-memory DB so construction
// never touches the filesystem. Real requests always run outside the build.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

function openDatabase(): DatabaseSync {
  if (isBuild) return new DatabaseSync(":memory:");
  // Ensure the parent dir exists before opening (dev / first boot).
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
  return new DatabaseSync(env.DATABASE_PATH);
}

const db = openDatabase();

const oauthPlugins = isPocketIdConfigured
  ? [
      genericOAuth({
        config: [
          {
            providerId: "pocketid",
            // Discovery document derived from the issuer base URL — issuer,
            // endpoints and JWKS are all fetched from here.
            discoveryUrl: `${env.POCKETID_ISSUER_URL.replace(/\/$/, "")}/.well-known/openid-configuration`,
            clientId: env.POCKETID_CLIENT_ID,
            clientSecret: env.POCKETID_CLIENT_SECRET,
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
    ]
  : [];

export const auth = betterAuth({
  database: db,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  // Email/password is the break-glass path. Public sign-up is disabled — the
  // only local account is the env-seeded admin (see instrumentation.ts). New
  // users otherwise arrive through PocketID.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },

  // PocketID is trusted: link by verified email and auto-provision on first
  // login. PocketID itself is the gate on who may sign in.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["pocketid"],
    },
  },

  // nextCookies must be last so Set-Cookie is flushed on server actions.
  plugins: [...oauthPlugins, nextCookies()],
});

/**
 * Guard for route handlers that perform destructive/mutating actions. Returns
 * the session when present, or a 401 Response to return directly otherwise.
 */
export async function requireSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    return {
      session: null,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { session, response: null } as const;
}
