import { ListVideo } from "lucide-react";
import { getLibraryPlaylists } from "@/lib/library";
import { formatDuration } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const { playlists, source } = await getLibraryPlaylists();

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader title="Playlists" subtitle="Curate at the track level. Add, remove, reorder." />
      <SourceBanner source={source} />
      <div className="grid gap-3 px-6 pb-10 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <ListVideo className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{pl.name}</div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {pl.songCount} songs · {formatDuration(pl.durationSecs)}
                {pl.public && " · public"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
