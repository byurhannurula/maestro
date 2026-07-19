import { getLibrarySongs, getLibraryPlaylists } from "@/lib/library";
import { env } from "@/lib/env";
import { nowMs } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";
import { SongsTable } from "@/components/songs-table";

export const dynamic = "force-dynamic";

export default async function CleanupPage() {
  // Stale finder: ONLY never-played tracks (the dead weight).
  const [initial, { playlists }] = await Promise.all([
    getLibrarySongs({
      start: 0,
      end: env.DEFAULT_PAGE_SIZE,
      sort: "playCount",
      order: "ASC",
      unplayedOnly: true,
      staleDays: env.CLEANUP_MIN_AGE_DAYS,
    }),
    getLibraryPlaylists(),
  ]);
  const now = nowMs();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Cleanup"
          subtitle="Tracks you've never played and didn't just add — the dead weight. Tune the age cutoff to exclude fresh imports. Files move to ./trash, nothing is destroyed."
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
          defaultPageSize={env.DEFAULT_PAGE_SIZE}
          defaultStaleDays={env.CLEANUP_MIN_AGE_DAYS}
          unplayedOnly
        />
      </div>
    </div>
  );
}
