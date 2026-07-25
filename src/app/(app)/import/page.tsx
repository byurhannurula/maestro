import { PageHeader } from "@/components/page-header";
import { ImportView } from "@/components/views/import-view";
import { getLibraryPlaylists } from "@/lib/navidrome/library";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const { playlists } = await getLibraryPlaylists();

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Import"
        subtitle="Paste or drop a list of songs — 'Artist - Title' per line. They download via deemix, then land in Navidrome and your chosen playlist."
      />
      <ImportView playlists={playlists} />
    </div>
  );
}
