import "server-only";
import { z } from "zod";

/**
 * All runtime configuration comes from environment variables — nothing is
 * hard-coded. Values are validated once, at first import, on the server only.
 *
 * Nothing here is exposed to the browser (no NEXT_PUBLIC_* secrets).
 */
const schema = z.object({
  // --- Navidrome (Subsonic + Native API) ---
  NAVIDROME_URL: z.string().default("http://navidrome:4533"),
  NAVIDROME_USERNAME: z.string().default(""),
  NAVIDROME_PASSWORD: z.string().default(""),

  // --- deemix webui REST API ---
  DEEMIX_URL: z.string().default("http://deemix:6595"),
  DEEMIX_ARL: z.string().default(""),

  // --- Filesystem (shared volumes) ---
  MUSIC_DIR: z.string().default("/music"),
  TRASH_DIR: z.string().default("/trash"),

  // --- App state ---
  // Also the SQLite file backing better-auth (users / sessions / accounts).
  // Container deployments set this to /data/maestro.db (see docker-compose);
  // the relative default keeps `pnpm dev` working without a writable /data.
  DATABASE_PATH: z.string().default("./data/maestro.db"),

  // --- Auth (better-auth) ---
  // Secret used to sign sessions/tokens. Generate with `openssl rand -hex 32`.
  BETTER_AUTH_SECRET: z.string().default(""),
  // Public origin the app is served from, e.g. https://maestro.example.com.
  // Used for OAuth callbacks and cookie scoping.
  BETTER_AUTH_URL: z.string().default("http://localhost:4544"),

  // Seed admin (break-glass email/password login). Created once on first boot
  // if it doesn't already exist. Leave blank to skip seeding.
  ADMIN_EMAIL: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
  ADMIN_NAME: z.string().default("Admin"),

  // --- OIDC via PocketID (generic OAuth) ---
  // Base URL of the PocketID instance; discovery document is derived from it.
  POCKETID_ISSUER_URL: z.string().default(""),
  POCKETID_CLIENT_ID: z.string().default(""),
  POCKETID_CLIENT_SECRET: z.string().default(""),

  // --- Caching ---
  // How long Navidrome reads are cached (seconds). Busted immediately on any
  // in-app mutation (star / delete / playlist edit / import). Default 24h.
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(86_400),

  // --- Import pipeline tuning ---
  IMPORT_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  IMPORT_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),

  // --- UI ---
  // Default rows per page / initial fetch size (user can override in the UI).
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(25),

  // Cleanup default age cutoff (days). Never-played tracks added more recently
  // than this are treated as fresh imports and hidden from Cleanup, so the list
  // shows genuine dead weight rather than things you just downloaded. 0 = off.
  CLEANUP_MIN_AGE_DAYS: z.coerce.number().int().nonnegative().default(30),

  // --- Webhook ingest (Shazam / iOS Shortcut) ---
  WEBHOOK_SECRET: z.string().default(""),
  WEBHOOK_PLAYLIST: z.string().default("Shazam"),

  // --- Server ---
  PORT: z.coerce.number().int().positive().default(4544),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();

/** True when enough is set to talk to Navidrome. */
export const isNavidromeConfigured =
  env.NAVIDROME_USERNAME.length > 0 && env.NAVIDROME_PASSWORD.length > 0;

/** True when a deemix endpoint is configured. */
export const isDeemixConfigured = env.DEEMIX_URL.length > 0;

/** True when PocketID (OIDC) credentials are present. */
export const isPocketIdConfigured =
  env.POCKETID_ISSUER_URL.length > 0 &&
  env.POCKETID_CLIENT_ID.length > 0 &&
  env.POCKETID_CLIENT_SECRET.length > 0;

/** True when a seed admin should be provisioned on boot. */
export const hasSeedAdmin = env.ADMIN_EMAIL.length > 0 && env.ADMIN_PASSWORD.length > 0;
