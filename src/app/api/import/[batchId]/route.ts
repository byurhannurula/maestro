import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { getBatch, deleteBatch } from "@/lib/import/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(batch);
}

/** Remove a single batch from history. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const gate = await requireSession(req.headers);
  if (gate.response) return gate.response;

  const { batchId } = await ctx.params;
  const existed = deleteBatch(batchId);
  if (!existed) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
