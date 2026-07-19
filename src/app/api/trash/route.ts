import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { emptyTrash, getTrashInfo } from "@/lib/trash";

export const dynamic = "force-dynamic";

/** GET → current trash size + file count. */
export async function GET() {
  const gate = await requireSession(await headers());
  if (gate.response) return gate.response;

  return NextResponse.json(await getTrashInfo());
}

/** DELETE → permanently empty ./trash; returns bytes/files freed. */
export async function DELETE() {
  const gate = await requireSession(await headers());
  if (gate.response) return gate.response;

  const freed = await emptyTrash();
  return NextResponse.json({ emptied: true, ...freed });
}
