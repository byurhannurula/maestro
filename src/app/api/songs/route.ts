import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getLibrarySongs } from "@/lib/navidrome/library";
import type { SongSortKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const SORT_KEYS: SongSortKey[] = [
  "title",
  "artist",
  "album",
  "playCount",
  "createdAt",
  "lastPlayed",
];
const MAX_PAGE = 500;

export async function GET(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const sp = req.nextUrl.searchParams;

  const start = Math.max(0, Number(sp.get("start")) || 0);
  const requestedEnd = Number(sp.get("end")) || start + MAX_PAGE;
  // Hard-cap the page size to 100 rows per request.
  const end = Math.min(requestedEnd, start + MAX_PAGE);

  const sortParam = sp.get("sort") as SongSortKey | null;
  const sort: SongSortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : "title";
  const order = sp.get("order") === "DESC" ? "DESC" : "ASC";
  const search = sp.get("search") ?? undefined;
  const playlistId = sp.get("playlist") ?? undefined;
  const favoritesOnly = sp.get("favorites") === "1";
  const unplayedOnly = sp.get("unplayed") === "1";
  const staleDays = Math.max(0, Number(sp.get("staleDays")) || 0);

  const result = await getLibrarySongs({
    start,
    end,
    sort,
    order,
    search,
    playlistId,
    favoritesOnly,
    unplayedOnly,
    staleDays,
  });
  return NextResponse.json(result);
}
