/** Presentation helpers — safe on both server and client. */

/** Request-time clock. Wrapped so it's read outside component render scope. */
export const nowMs = (): number => Date.now();

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / 1024 ** i;
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Compact humanised uptime, e.g. "2d 3h", "15m". */
export function formatUptime(totalSecs: number): string {
  if (!Number.isFinite(totalSecs) || totalSecs < 1) return "just started";
  const d = Math.floor(totalSecs / 86_400);
  const h = Math.floor((totalSecs % 86_400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDuration(totalSecs: number): string {
  if (!Number.isFinite(totalSecs) || totalSecs <= 0) return "0:00";
  const m = Math.floor(totalSecs / 60);
  const s = Math.floor(totalSecs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Relative "3d ago" / "just now" from an ISO string, against a given now. */
export function relativeTime(iso: string | undefined, now: number): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, now - then);
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
