"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useShortcutHint } from "@/components/shortcuts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Shared mounted-gate: the resolved theme is unknown during SSR. */
function useThemeState() {
  const state = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return { ...state, mounted };
}

/**
 * Standalone icon-button dropdown to pick Light / Dark / System. Used where
 * there's no surrounding menu to embed into (e.g. the login page).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, mounted } = useThemeState();
  const Icon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle theme"
        title="Theme"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          className,
        )}
      >
        <Icon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <OptionIcon className="size-4" />
            <span className="flex-1">{label}</span>
            {mounted && theme === value && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Theme picker as a submenu, for embedding inside an existing dropdown (e.g. the
 * sidebar profile menu). Must be rendered within a DropdownMenuContent.
 */
export function ThemeMenuSub() {
  const { theme, resolvedTheme, setTheme, mounted } = useThemeState();
  const TriggerIcon = mounted && resolvedTheme === "dark" ? Moon : Sun;
  const hint = useShortcutHint("toggle-theme");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <TriggerIcon className="size-4" /> Theme
        {hint && <DropdownMenuShortcut>{hint}</DropdownMenuShortcut>}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme}>
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <OptionIcon className="size-4" /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
