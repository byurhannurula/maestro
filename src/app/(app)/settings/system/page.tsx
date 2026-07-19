import { Database, Server, SlidersHorizontal } from "lucide-react";
import { env } from "@/lib/env";
import { APP_VERSION } from "@/lib/version";
import { formatUptime } from "@/lib/format";
import { SettingsCard, Field } from "@/components/settings-ui";

export const dynamic = "force-dynamic";

export default function SystemSettings() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
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
        <Field label="Webhook playlist" value={env.WEBHOOK_PLAYLIST} mono />
      </SettingsCard>

      <SettingsCard title="Paths" icon={Database} className="lg:col-span-2">
        <Field label="Music" value={env.MUSIC_DIR} mono />
        <Field label="Trash" value={env.TRASH_DIR} mono />
        <Field label="Database" value={env.DATABASE_PATH} mono />
      </SettingsCard>
    </div>
  );
}
