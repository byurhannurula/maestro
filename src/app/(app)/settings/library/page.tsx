import { Download, HardDrive, Library, Server } from "lucide-react";
import { getLibraryStats, getSystemStatus } from "@/lib/library";
import { getScanStatus, getServerInfo } from "@/lib/subsonic";
import { getTrashInfo } from "@/lib/trash";
import { formatBytes, formatDuration } from "@/lib/format";
import { SettingsCard, Field, Stat, type FieldState } from "@/components/settings-ui";
import { EmptyTrashButton } from "@/components/empty-trash-button";
import { ScanButton } from "@/components/scan-button";

export const dynamic = "force-dynamic";

export default async function LibrarySettings() {
  const [s, server, scan, trash, stats] = await Promise.all([
    getSystemStatus(),
    getServerInfo(),
    getScanStatus().catch(() => ({ scanning: false, count: 0 })),
    getTrashInfo(),
    getLibraryStats(),
  ]);

  const bool = (b: boolean): FieldState => (b ? "ok" : "bad");
  const num = (n: number) => n.toLocaleString();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard title="Library" icon={Library} className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Tracks" value={num(stats.totalTracks)} />
          <Stat label="Favourites" value={num(stats.favourites)} />
          <Stat label="Never played" value={num(stats.neverPlayed)} />
          <Stat label="Playlists" value={num(stats.playlists)} />
          <Stat label="Playlist tracks" value={num(stats.playlistTracks)} />
          <Stat label="Playlist time" value={formatDuration(stats.playlistDurationSecs)} />
        </div>
      </SettingsCard>

      <SettingsCard title="Navidrome" icon={Server} action={s.navidrome.reachable ? <ScanButton /> : null}>
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
      </SettingsCard>

      <SettingsCard title="Download backend" icon={Download}>
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
        className="lg:col-span-2"
        action={<EmptyTrashButton files={trash.files} bytes={trash.bytes} />}
      >
        <Field label="Music" value={s.paths.music} mono />
        <Field label="Trash" value={s.paths.trash} mono />
        <Field
          label="Trash size"
          value={`${formatBytes(trash.bytes)} · ${num(trash.files)} file${trash.files === 1 ? "" : "s"}`}
        />
      </SettingsCard>
    </div>
  );
}
