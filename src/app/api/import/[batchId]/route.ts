import { NextResponse } from "next/server";
import { getBatch, deleteBatch } from "@/lib/import/store";
import { withSession, jsonError } from "@/lib/route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ batchId: string }> };

export const GET = withSession<Ctx>(async (_req, ctx) => {
  const { batchId } = await ctx.params;
  const batch = getBatch(batchId);
  if (!batch) return jsonError("not found", 404);
  return NextResponse.json(batch);
});

/** Remove a single batch from history. */
export const DELETE = withSession<Ctx>(async (_req, ctx) => {
  const { batchId } = await ctx.params;
  const existed = deleteBatch(batchId);
  if (!existed) return jsonError("not found", 404);
  return NextResponse.json({ ok: true });
});
