import { PageHeader } from "@/components/page-header";
import { PlaylistsManager } from "@/components/playlists-manager";
import { SourceBanner } from "@/components/source-banner";
import { getLibraryPlaylists } from "@/lib/navidrome/library";

export const dynamic = "force-dynamic";

export default async function PlaylistsPage() {
  const { playlists, source } = await getLibraryPlaylists();

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Playlists"
        subtitle="Create, open, or delete playlists. Click one to open it scoped in All Songs."
      />
      <SourceBanner source={source} />
      <div className="px-6 pb-10">
        <PlaylistsManager playlists={playlists} />
      </div>
    </div>
  );
}
