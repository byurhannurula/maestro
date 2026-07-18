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
  DATABASE_PATH: z.string().default("/data/navi-organiser.db"),

  // --- Import pipeline tuning ---
  IMPORT_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  IMPORT_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),

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
