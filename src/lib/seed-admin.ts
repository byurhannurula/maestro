import "server-only";
import { auth } from "./auth";
import { env, hasSeedAdmin } from "./env";

/**
 * Provision the break-glass admin from ADMIN_EMAIL / ADMIN_PASSWORD, once.
 *
 * Uses better-auth's internal adapter directly rather than the public sign-up
 * route, so it bypasses `disableSignUp` — public registration stays closed
 * while this seeded account always works. Idempotent: a no-op if the user
 * already exists, so it's safe to run on every boot.
 */
export async function seedAdmin(): Promise<void> {
  if (!hasSeedAdmin) return;

  const email = env.ADMIN_EMAIL.toLowerCase();
  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) return;

  const user = await ctx.internalAdapter.createUser({
    email,
    name: env.ADMIN_NAME,
    emailVerified: true,
  });

  const hash = await ctx.password.hash(env.ADMIN_PASSWORD);
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });

  console.log(`[seed] created admin user ${email}`);
}
