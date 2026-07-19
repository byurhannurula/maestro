import { DiscoveryView } from "@/components/discovery-view";
import { PageHeader } from "@/components/page-header";
import { getDiscoveryPlaylists } from "@/lib/discovery";
import { isDiscoveryConfigured, isLastfmConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery · Maestro" };

/**
 * Discovery: browse what ListenBrainz recommends for your account, preview each
 * track (30s via Deezer), and download only the ones you pick into the deemix
 * pipeline. A manual, pick-what-you-want counterpart to Explo's auto-downloads.
 */
export default async function DiscoveryPage() {
  const playlists = isDiscoveryConfigured ? await getDiscoveryPlaylists().catch(() => []) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Discovery"
          subtitle="What the platforms recommend — preview, then download only what you want."
        />
      </div>
      <div className="min-h-0 flex-1">
        <DiscoveryView
          configured={isDiscoveryConfigured}
          lastfm={isLastfmConfigured}
          playlists={playlists}
        />
      </div>
    </div>
  );
}
