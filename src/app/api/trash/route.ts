import { NextResponse } from "next/server";
import { emptyTrash, getTrashInfo } from "@/lib/trash";

export const dynamic = "force-dynamic";

/** GET → current trash size + file count. */
export async function GET() {
  return NextResponse.json(await getTrashInfo());
}

/** DELETE → permanently empty ./trash; returns bytes/files freed. */
export async function DELETE() {
  const freed = await emptyTrash();
  return NextResponse.json({ emptied: true, ...freed });
}
