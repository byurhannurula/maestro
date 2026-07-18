import { getLibrarySongs } from "@/lib/library";
import { nowMs } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";
import { SongsTable } from "@/components/songs-table";

export const dynamic = "force-dynamic";

export default async function CleanupPage() {
  const { songs, source, error } = await getLibrarySongs({ end: 500, sort: "createdAt" });
  const now = nowMs();
  // Stale finder: never-played tracks — the dead weight. Delete moves to ./trash.
  const stale = songs.filter((s) => s.playCount === 0);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Cleanup"
          subtitle={`${stale.length} never-played tracks. Select and delete — files move to ./trash, nothing is destroyed.`}
        />
        <SourceBanner source={source} error={error} />
      </div>
      <div className="min-h-0 flex-1">
        <SongsTable songs={stale} now={now} />
      </div>
    </div>
  );
}
