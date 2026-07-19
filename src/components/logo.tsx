import { cn } from "@/lib/utils";

/**
 * Maestro brand mark — an equaliser glyph in a rounded green tile. Uses theme
 * tokens (bg-primary / primary-foreground) so it matches the accent everywhere.
 * Mirror of /app/icon.svg (the favicon). Size is in px.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
      style={{ width: size, height: size, borderRadius: Math.round(size / 4) }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.6}
        height={size * 0.6}
        fill="currentColor"
        role="img"
      >
        <rect x="5" y="8" width="3" height="8" rx="1.5" />
        <rect x="10.5" y="4" width="3" height="16" rx="1.5" />
        <rect x="16" y="10" width="3" height="6" rx="1.5" />
      </svg>
    </div>
  );
}

/** Horizontal logo + "Maestro" wordmark. Text uses theme tokens. */
export function Wordmark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <span
        className="font-bold tracking-tight text-foreground"
        style={{ fontSize: Math.round(size * 0.7) }}
      >
        Maestro
      </span>
    </div>
  );
}
