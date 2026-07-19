/**
 * One-time server startup hook. Runs only in the Node.js runtime (never edge),
 * so it's safe to touch the SQLite handle and filesystem here. Creates the
 * better-auth tables if missing, then seeds the break-glass admin.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runAuthMigrations } = await import("./lib/db-migrate");
  const { seedAdmin } = await import("./lib/seed-admin");
  try {
    await runAuthMigrations();
    await seedAdmin();
  } catch (err) {
    console.error("[auth] startup initialization failed:", err);
  }
}
