"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Lightweight collapsible-sidebar state. On desktop the collapse preference is
 * persisted to a cookie so the server layout can render the correct width on
 * first paint (no flash). On mobile the sidebar is an overlay drawer that
 * auto-collapses (and stays out of the cookie, so the desktop preference is
 * never clobbered). Toggle via a header trigger or the `Ctrl/⌘+B` shortcut.
 */

const COOKIE = "sidebar_collapsed";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const MOBILE_QUERY = "(max-width: 767px)";

interface Ctx {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<Ctx | null>(null);

export function SidebarProvider({
  defaultCollapsed = false,
  children,
}: {
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed);
  // Whether we're currently in the mobile breakpoint. Read live inside the
  // setters so we only persist the collapse preference on desktop.
  const isMobile = useRef(false);

  const writeCookie = (v: boolean) => {
    document.cookie = `${COOKIE}=${v ? "1" : "0"}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  };

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    if (!isMobile.current) writeCookie(v);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      if (!isMobile.current) writeCookie(next);
      return next;
    });
  }, []);

  // Force-collapse on mobile (overlay drawer); restore the desktop preference
  // when the viewport grows back. Transient — never touches the cookie.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      isMobile.current = mql.matches;
      setCollapsedState(mql.matches ? true : defaultCollapsed);
    };
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [defaultCollapsed]);

  const value = useMemo<Ctx>(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): Ctx {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
