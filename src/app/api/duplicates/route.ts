import { NextResponse, type NextRequest } from "next/server";
import { getDuplicateGroups } from "@/lib/library";

export const dynamic = "force-dynamic";

/** GET → duplicate clusters. `?match=aggressive` loosens title normalisation. */
export async function GET(req: NextRequest) {
  const aggressive = req.nextUrl.searchParams.get("match") === "aggressive";
  return NextResponse.json(await getDuplicateGroups(aggressive));
}
