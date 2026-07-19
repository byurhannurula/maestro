import { cn } from "@/lib/utils";

export type FieldState = "ok" | "bad" | "off" | "muted";

/** Titled card with an icon and optional right-aligned action. */
export function SettingsCard({
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

/** Label / value row. */
export function Field({
  label,
  value,
  mono,
  state = "muted",
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  state?: FieldState;
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

/** Big-number stat tile. */
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2.5">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
