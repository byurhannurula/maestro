import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getDuplicateGroups } from "@/lib/library";

export const dynamic = "force-dynamic";

/** GET → duplicate clusters. `?match=aggressive` loosens title normalisation. */
export async function GET(req: NextRequest) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const aggressive = req.nextUrl.searchParams.get("match") === "aggressive";
  return NextResponse.json(await getDuplicateGroups(aggressive));
}
