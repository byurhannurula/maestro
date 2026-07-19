import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { getLibraryPlaylists } from "@/lib/navidrome/library";
import { auth } from "@/lib/auth";

/**
 * Authenticated app shell. This is the real auth gate: `proxy.ts` only does an
 * optimistic cookie check, so we validate the session against the database here
 * before rendering any library data.
 */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const { playlists } = await getLibraryPlaylists();
  const displayName = session.user.name || session.user.email;

  return (
    <div className="flex h-full">
      <AppSidebar playlists={playlists} username={displayName} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
