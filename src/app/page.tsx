import { getLibrarySongs, getLibraryPlaylists } from "@/lib/library";
import { nowMs } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { SourceBanner } from "@/components/source-banner";
import { SongsTable } from "@/components/songs-table";

export const dynamic = "force-dynamic";

export default async function AllSongsPage({
  searchParams,
}: {
  searchParams: Promise<{ playlist?: string }>;
}) {
  const { playlist } = await searchParams;
  const playlistId = playlist || undefined;

  const [initial, playlistsRes] = await Promise.all([
    getLibrarySongs({ start: 0, end: 25, sort: "createdAt", order: "DESC", playlistId }),
    getLibraryPlaylists(),
  ]);

  const playlists = playlistsRes.playlists;
  const selectedName = playlistId
    ? playlists.find((p) => p.id === playlistId)?.name
    : undefined;
  const now = nowMs();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title={selectedName ?? "All Songs"}
          subtitle={
            selectedName
              ? `Playlist · ${initial.total.toLocaleString()} tracks`
              : "Your whole library, flat. Sort, filter, select — no album pages."
          }
        />
        <SourceBanner source={initial.source} error={initial.error} />
      </div>
      <div className="min-h-0 flex-1">
        <SongsTable
          key={playlistId ?? "all"}
          initial={initial}
          now={now}
          playlists={playlists}
          playlistId={playlistId}
          defaultSort="createdAt"
          defaultOrder="DESC"
        />
      </div>
    </div>
  );
}
