import { headers } from "next/headers";
import {
  Download,
  HardDrive,
  Library,
  Server,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getLibraryStats, getSystemStatus } from "@/lib/library";
import { getScanStatus, getServerInfo } from "@/lib/subsonic";
import { getTrashInfo } from "@/lib/trash";
import { env, isPocketIdConfigured } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";
import { formatBytes, formatDuration, formatUptime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { EmptyTrashButton } from "@/components/empty-trash-button";
import { ScanButton } from "@/components/scan-button";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

type State = "ok" | "bad" | "off" | "muted";

function Card({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  state = "muted",
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  state?: State;
}) {
  const color =
    state === "ok"
      ? "text-emerald-400"
      : state === "bad"
        ? "text-red-400"
        : state === "off"
          ? "text-muted-foreground/60"
          : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("truncate text-right", mono && "font-mono text-xs", color)}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function SystemPage() {
  const [session, s, server, scan, trash, stats] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getSystemStatus(),
    getServerInfo(),
    getScanStatus().catch(() => ({ scanning: false, count: 0 })),
    getTrashInfo(),
    getLibraryStats(),
  ]);

  const bool = (b: boolean): State => (b ? "ok" : "bad");
  const num = (n: number) => n.toLocaleString();
  const user = session?.user;

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader title="System" subtitle="Health, library stats, and configuration — at a glance." />

      <div className="grid gap-4 px-6 pb-10 lg:grid-cols-2">
        {/* Account */}
        <Card title="Account" icon={User} action={<SignOutButton />}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {(user?.name || user?.email || "M").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name || "Signed in"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <Field label="Sign-in" state="ok" value="Active session" />
          <Field
            label="PocketID (OIDC)"
            state={isPocketIdConfigured ? "ok" : "off"}
            value={isPocketIdConfigured ? "enabled" : "not configured"}
          />
        </Card>

        {/* Application */}
        <Card title="Application" icon={Server}>
          <Field label="Version" value={`v${APP_VERSION}`} mono />
          <Field label="Environment" value={process.env.NODE_ENV} mono />
          <Field label="Node" value={process.version} mono />
          <Field label="Uptime" value={formatUptime(process.uptime())} />
          <Field label="Port" value={String(env.PORT)} mono />
        </Card>

        {/* Library stats — full width */}
        <Card title="Library" icon={Library} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Tracks" value={num(stats.totalTracks)} />
            <Stat label="Favourites" value={num(stats.favourites)} />
            <Stat label="Never played" value={num(stats.neverPlayed)} />
            <Stat label="Playlists" value={num(stats.playlists)} />
            <Stat label="Playlist tracks" value={num(stats.playlistTracks)} />
            <Stat label="Playlist time" value={formatDuration(stats.playlistDurationSecs)} />
          </div>
        </Card>

        {/* Navidrome */}
        <Card title="Navidrome" icon={Server} action={s.navidrome.reachable ? <ScanButton /> : null}>
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
            value={server.serverVersion ? `${server.type ?? "navidrome"} ${server.serverVersion}` : "—"}
            mono
          />
          <Field label="URL" value={s.navidrome.url} mono />
          <Field
            label="Scanner"
            state={scan.scanning ? "ok" : "muted"}
            value={scan.scanning ? "scanning…" : `idle · ${num(scan.count)} indexed`}
          />
        </Card>

        {/* deemix / download backend */}
        <Card title="Download backend" icon={Download}>
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
        </Card>

        {/* Storage */}
        <Card
          title="Storage"
          icon={HardDrive}
          action={<EmptyTrashButton files={trash.files} bytes={trash.bytes} />}
        >
          <Field label="Music" value={s.paths.music} mono />
          <Field label="Trash" value={s.paths.trash} mono />
          <Field label="Database" value={s.paths.database} mono />
          <Field
            label="Trash size"
            value={`${formatBytes(trash.bytes)} · ${num(trash.files)} file${trash.files === 1 ? "" : "s"}`}
          />
        </Card>

        {/* Configuration */}
        <Card title="Configuration" icon={SlidersHorizontal}>
          <Field label="Read cache" value={`${Math.round(env.CACHE_TTL_SECONDS / 3600)}h`} />
          <Field label="Default page size" value={String(env.DEFAULT_PAGE_SIZE)} />
          <Field label="Cleanup age cutoff" value={`${env.CLEANUP_MIN_AGE_DAYS} days`} />
          <Field label="Import delay" value={`${env.IMPORT_DELAY_MS} ms`} />
          <Field label="Webhook playlist" value={env.WEBHOOK_PLAYLIST} mono />
        </Card>
      </div>
    </div>
  );
}
