import "server-only";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "@/lib/auth";

/**
 * Create/patch the better-auth tables in the SQLite file at runtime. The schema
 * lives on the /data volume (not the build image), so migrations must run on
 * boot rather than at build time. Idempotent: introspects the DB and applies
 * only the missing tables/columns, so it's a no-op once up to date.
 */
export async function runAuthMigrations(): Promise<void> {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
  if (toBeCreated.length === 0 && toBeAdded.length === 0) return;
  await runMigrations();
  console.log(
    `[migrate] auth schema updated: +${toBeCreated.length} table(s), +${toBeAdded.length} column set(s)`,
  );
}
