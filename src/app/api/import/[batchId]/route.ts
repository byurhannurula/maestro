import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBatch } from "@/lib/import/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(batch);
}
