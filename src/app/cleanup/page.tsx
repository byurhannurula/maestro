import { getLibrarySongs, getLibraryPlaylists } from "@/lib/library";
import { nowMs } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";
import { SongsTable } from "@/components/songs-table";

export const dynamic = "force-dynamic";

export default async function CleanupPage() {
  // Stale finder: least-played first, so never-played tracks surface at the top.
  const [initial, { playlists }] = await Promise.all([
    getLibrarySongs({ start: 0, end: 100, sort: "playCount", order: "ASC" }),
    getLibraryPlaylists(),
  ]);
  const now = nowMs();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Cleanup"
          subtitle="Least-played first — never-played tracks are at the top. Select and delete; files move to ./trash, nothing is destroyed."
        />
        <SourceBanner source={initial.source} error={initial.error} />
      </div>
      <div className="min-h-0 flex-1">
        <SongsTable
          initial={initial}
          now={now}
          playlists={playlists}
          defaultSort="playCount"
          defaultOrder="ASC"
        />
      </div>
    </div>
  );
}
