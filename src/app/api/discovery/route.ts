import { NextResponse } from "next/server";
import {
  getDiscoveryPlaylists,
  getDiscoveryTracks,
  getRecommendedTracks,
  getArtistRecos,
  getArtistTracks,
} from "@/lib/discovery";
import { isDiscoveryConfigured } from "@/lib/env";
import { withSession, jsonError } from "@/lib/route";
import { errMsg } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/discovery               → ListenBrainz recommendation playlists (cards)
 * GET /api/discovery?playlist=MBID → that playlist's enriched tracks
 * GET /api/discovery?recommended=1 → Last.fm recommended tracks
 * GET /api/discovery?artists=1     → Last.fm similar-artist suggestions
 * GET /api/discovery?artist=NAME   → that artist's enriched top tracks
 */
export const GET = withSession(async (req) => {
  const sp = req.nextUrl.searchParams;
  const fresh = sp.get("refresh") === "1";
  try {
    if (sp.get("recommended")) {
      return NextResponse.json({ tracks: await getRecommendedTracks(fresh) });
    }
    if (sp.get("artists")) {
      return NextResponse.json({ artists: await getArtistRecos(fresh) });
    }
    const artist = sp.get("artist");
    if (artist) {
      return NextResponse.json({ tracks: await getArtistTracks(artist) });
    }

    if (!isDiscoveryConfigured) {
      return NextResponse.json({ configured: false, playlists: [] });
    }
    const mbid = sp.get("playlist");
    if (mbid) {
      return NextResponse.json({ configured: true, tracks: await getDiscoveryTracks(mbid) });
    }
    return NextResponse.json({ configured: true, playlists: await getDiscoveryPlaylists() });
  } catch (e) {
    // Upstream (ListenBrainz/Deezer/Last.fm) failures → 502, not the generic 500.
    return jsonError(errMsg(e), 502);
  }
});
