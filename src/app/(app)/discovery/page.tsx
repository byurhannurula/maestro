import { PageHeader } from "@/components/page-header";
import { DiscoveryView } from "@/components/discovery-view";
import {
  recommendedMixes,
  recommendedTracks,
  similarArtists,
} from "@/lib/sample-discovery";

export const metadata = { title: "Discovery · Maestro" };

/**
 * Discovery (mockup). Surfaces recommendations seeded from the library so you
 * can grow it without leaving the app. Not wired to any provider yet — see
 * src/lib/sample-discovery.ts for the placeholder data and the intended shape.
 */
export default function DiscoveryPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Discovery"
          subtitle="New music tuned to your library. Queue a track or a whole mix straight into the download pipeline."
        />
      </div>
      <div className="min-h-0 flex-1">
        <DiscoveryView
          tracks={recommendedTracks}
          artists={similarArtists}
          mixes={recommendedMixes}
        />
      </div>
    </div>
  );
}
