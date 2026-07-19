import { NextResponse } from "next/server";
import { getDuplicateGroups } from "@/lib/navidrome/library";
import { withSession } from "@/lib/route";

export const dynamic = "force-dynamic";

/** GET → duplicate clusters. `?match=aggressive` loosens title normalisation. */
export const GET = withSession(async (req) => {
  const aggressive = req.nextUrl.searchParams.get("match") === "aggressive";
  return NextResponse.json(await getDuplicateGroups(aggressive));
});
