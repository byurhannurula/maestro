"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/library", label: "Library" },
  { href: "/settings/system", label: "System" },
];

/** Sub-navigation for the Settings area. */
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {TABS.map((t) => {
        const on = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              on
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
