import { getLibrarySongs } from "@/lib/library";
import { nowMs } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";
import { SongsTable } from "@/components/songs-table";

export const dynamic = "force-dynamic";

export default async function AllSongsPage() {
  const { songs, source, error } = await getLibrarySongs({ end: 500, sort: "title" });
  const now = nowMs();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="All Songs"
          subtitle="Your whole library, flat. Sort, filter, select — no album pages."
        />
        <SourceBanner source={source} error={error} />
      </div>
      <div className="min-h-0 flex-1">
        <SongsTable songs={songs} now={now} />
      </div>
    </div>
  );
}
