import { CleanupTabs } from "@/components/cleanup-tabs";
import { DuplicatesView } from "@/components/duplicates-view";
import { PageHeader } from "@/components/page-header";
import { SongsTable } from "@/components/songs-table";
import { SourceBanner } from "@/components/source-banner";
import { env } from "@/lib/env";
import { nowMs } from "@/lib/format";
import { getLibrarySongs, getLibraryPlaylists } from "@/lib/navidrome/library";

export const dynamic = "force-dynamic";

export default async function CleanupPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const now = nowMs();

  if (view === "duplicates") {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0">
          <PageHeader
            title="Cleanup"
            subtitle="Duplicate copies of the same track. Keep one, trash the rest — files move to ./trash."
            actions={<CleanupTabs />}
          />
        </div>
        <div className="min-h-0 flex-1">
          <DuplicatesView now={now} />
        </div>
      </div>
    );
  }

  // Stale finder: never-played tracks that weren't just added (the dead weight).
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Cleanup"
          subtitle="Tracks you've never played and didn't just add — the dead weight. Tune the age cutoff to exclude fresh imports. Files move to ./trash, nothing is destroyed."
          actions={<CleanupTabs />}
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
