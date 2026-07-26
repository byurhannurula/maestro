import { PageHeader } from "@/components/page-header";
import { FolderView } from "@/components/views/folder-view";
import { nowMs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function FoldersPage() {
  const now = nowMs();
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <PageHeader
          title="Folders"
          subtitle="The real ./music volume — see what Navidrome's index hides. Orphaned files, stray downloads, and unindexed leftovers. Delete moves to ./trash, never a hard delete."
        />
      </div>
      <div className="min-h-0 flex-1">
        <FolderView now={now} />
      </div>
    </div>
  );
}
