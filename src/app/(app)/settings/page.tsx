import { headers } from "next/headers";
import {
  Download,
  HardDrive,
  Library,
  Server,
  SlidersHorizontal,
  User,
  Webhook,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { env, isPocketIdConfigured, isWebhookEnabled } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";
import { getLibraryStats, getSystemStatus } from "@/lib/navidrome/library";
import { getScanStatus, getServerInfo } from "@/lib/navidrome/subsonic";
import { getTrashInfo } from "@/lib/storage/trash";
import { formatBytes, formatDuration, formatUptime } from "@/lib/format";
import { SettingsCard, Field, Stat, type FieldState } from "@/components/settings-ui";
import { SignOutButton } from "@/components/sign-out-button";
import { EmptyTrashButton } from "@/components/empty-trash-button";
import { ScanButton } from "@/components/scan-button";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Equal-width card row (1 col on mobile → N on lg). */
function Row({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-4", cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const [session, s, server, scan, trash, stats] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getSystemStatus(),
    getServerInfo(),
    getScanStatus().catch(() => ({ scanning: false, count: 0 })),
    getTrashInfo(),
    getLibraryStats(),
  ]);
  const user = session?.user;

  const bool = (b: boolean): FieldState => (b ? "ok" : "bad");
  const num = (n: number) => n.toLocaleString();

  return (
    <div className="flex flex-col gap-8">
      {/* Account */}
      <Section title="Account">
        <SettingsCard title="Account" icon={User} action={<SignOutButton />}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {(user?.name || user?.email || "M").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name || "Signed in"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <Field label="Session" state="ok" value="Active" />
          <Field
            label="PocketID (OIDC)"
            state={isPocketIdConfigured ? "ok" : "off"}
            value={isPocketIdConfigured ? "enabled" : "not configured"}
          />
          <Field label="Public sign-up" state="off" value="disabled" />
          <Field label="Email / password" state="ok" value="break-glass admin" />
        </SettingsCard>
      </Section>

      {/* Library */}
      <Section title="Library">
        <SettingsCard title="Library" icon={Library}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tracks" value={num(stats.totalTracks)} />
            <Stat label="Favourites" value={num(stats.favourites)} />
            <Stat label="Never played" value={num(stats.neverPlayed)} />
            <Stat label="Playlists" value={num(stats.playlists)} />
            <Stat label="Playlist tracks" value={num(stats.playlistTracks)} />
            <Stat label="Playlist time" value={formatDuration(stats.playlistDurationSecs)} />
          </div>
        </SettingsCard>

        <Row cols={3}>
          <SettingsCard
            title="Navidrome"
            icon={Server}
            action={s.navidrome.reachable ? <ScanButton /> : null}
          >
            <Field
              label="Status"
              state={s.navidrome.configured ? bool(s.navidrome.reachable) : "off"}
              value={
                !s.navidrome.configured
                  ? "not configured"
                  : s.navidrome.reachable
                    ? "connected"
                    : "unreachable"
              }
            />
            <Field
              label="Server"
              value={
                server.serverVersion ? `${server.type ?? "navidrome"} ${server.serverVersion}` : "—"
              }
              mono
            />
            <Field label="URL" value={s.navidrome.url} mono />
            <Field
              label="Scanner"
              state={scan.scanning ? "ok" : "muted"}
              value={scan.scanning ? "scanning…" : `idle · ${num(scan.count)} indexed`}
            />
          </SettingsCard>

          <SettingsCard title="Deemix" icon={Download}>
            <Field label="Reachable" state={bool(s.deemix.reachable)} value={s.deemix.url} mono />
            <Field
              label="Logged in"
              state={s.deemix.reachable ? bool(s.deemix.loggedIn) : "off"}
              value={s.deemix.loggedIn ? "session active" : "not logged in"}
            />
            <Field
              label="Deezer"
              state={s.deemix.reachable ? bool(s.deemix.deezerAvailable) : "off"}
              value={s.deemix.deezerAvailable ? "available" : "down / unknown"}
            />
          </SettingsCard>

          <SettingsCard
            title="Storage"
            icon={HardDrive}
            action={<EmptyTrashButton files={trash.files} bytes={trash.bytes} />}
          >
            <Field label="Music" value={env.MUSIC_DIR} mono />
            <Field label="Trash" value={env.TRASH_DIR} mono />
            <Field label="Database" value={env.DATABASE_PATH} mono />
            <Field
              label="Trash size"
              value={`${formatBytes(trash.bytes)} · ${num(trash.files)} file${trash.files === 1 ? "" : "s"}`}
            />
          </SettingsCard>
        </Row>
      </Section>

      {/* System */}
      <Section title="System">
        <Row cols={3}>
          <SettingsCard title="Application" icon={Server}>
            <Field label="Version" value={`v${APP_VERSION}`} mono />
            <Field label="Environment" value={process.env.NODE_ENV} mono />
            <Field label="Node" value={process.version} mono />
            <Field label="Uptime" value={formatUptime(process.uptime())} />
            <Field label="Port" value={String(env.PORT)} mono />
          </SettingsCard>

          <SettingsCard title="Configuration" icon={SlidersHorizontal}>
            <Field label="Read cache" value={`${Math.round(env.CACHE_TTL_SECONDS / 3600)}h`} />
            <Field label="Default page size" value={String(env.DEFAULT_PAGE_SIZE)} />
            <Field label="Cleanup age cutoff" value={`${env.CLEANUP_MIN_AGE_DAYS} days`} />
            <Field label="Import delay" value={`${env.IMPORT_DELAY_MS} ms`} />
            <Field label="Import timeout" value={`${Math.round(env.IMPORT_TIMEOUT_MS / 1000)}s`} />
          </SettingsCard>

          <SettingsCard title="Webhook" icon={Webhook}>
            <Field
              label="Status"
              state={isWebhookEnabled ? "ok" : "off"}
              value={isWebhookEnabled ? "enabled" : "disabled — set WEBHOOK_SECRET"}
            />
            <Field label="Endpoint" value={`${env.BETTER_AUTH_URL}/api/webhook/import`} mono />
            <Field label="Target playlist" value={env.WEBHOOK_PLAYLIST} mono />
            <Field label="Auth" value="Bearer WEBHOOK_SECRET" />
          </SettingsCard>
        </Row>
      </Section>
    </div>
  );
}
