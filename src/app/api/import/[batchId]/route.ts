import { NextResponse, type NextRequest } from "next/server";
import { getBatch } from "@/lib/import-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(batch);
}
