import { NextResponse } from "next/server";
import { withSession } from "@/lib/route";
import { emptyTrash, getTrashInfo } from "@/lib/storage/trash";

export const dynamic = "force-dynamic";

/** GET → current trash size + file count. */
export const GET = withSession(async () => {
  return NextResponse.json(await getTrashInfo());
});

/** DELETE → permanently empty ./trash; returns bytes/files freed. */
export const DELETE = withSession(async () => {
  const freed = await emptyTrash();
  return NextResponse.json({ emptied: true, ...freed });
});
