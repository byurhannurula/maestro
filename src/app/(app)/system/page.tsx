import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { getSystemStatus } from "@/lib/library";
import { getTrashInfo } from "@/lib/trash";
import { formatBytes } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyTrashButton } from "@/components/empty-trash-button";

export const dynamic = "force-dynamic";

type State = "ok" | "bad" | "off";

function Row({ label, state, detail }: { label: string; state: State; detail: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "bad" ? XCircle : MinusCircle;
  const color =
    state === "ok" ? "text-emerald-400" : state === "bad" ? "text-red-400" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <div className="flex items-center gap-2.5">
        <Icon className={`size-4 ${color}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="font-mono text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default async function SystemPage() {
  const [s, trash] = await Promise.all([getSystemStatus(), getTrashInfo()]);
  const bool = (b: boolean): State => (b ? "ok" : "bad");

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader title="System" subtitle="Is the whole stack healthy? One glance." />
      <div className="grid gap-4 px-6 pb-10 lg:grid-cols-2">
        <Card title="Navidrome">
          <Row
            label="Configured"
            state={s.navidrome.configured ? "ok" : "off"}
            detail={s.navidrome.configured ? "credentials set" : "not set"}
          />
          <Row
            label="Reachable"
            state={s.navidrome.configured ? bool(s.navidrome.reachable) : "off"}
            detail={s.navidrome.url}
          />
        </Card>

        <Card title="deemix / Deezer">
          <Row label="Reachable" state={bool(s.deemix.reachable)} detail={s.deemix.url} />
          <Row
            label="Logged in (ARL)"
            state={s.deemix.reachable ? bool(s.deemix.loggedIn) : "off"}
            detail={s.deemix.loggedIn ? "session active" : "not logged in"}
          />
          <Row
            label="Deezer available"
            state={s.deemix.reachable ? bool(s.deemix.deezerAvailable) : "off"}
            detail={s.deemix.deezerAvailable ? "up" : "down / unknown"}
          />
        </Card>

        <Card title="Storage paths">
          <Row label="Music" state="ok" detail={s.paths.music} />
          <Row label="Trash" state="ok" detail={s.paths.trash} />
          <Row label="Database" state="ok" detail={s.paths.database} />
        </Card>

        <Card title="Trash">
          <Row label="Size" state="ok" detail={formatBytes(trash.bytes)} />
          <Row
            label="Files"
            state="ok"
            detail={`${trash.files.toLocaleString()} deleted track${trash.files === 1 ? "" : "s"}`}
          />
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-muted-foreground">
              Deleted files stay here until you empty them.
            </span>
            <EmptyTrashButton files={trash.files} bytes={trash.bytes} />
          </div>
        </Card>
      </div>
    </div>
  );
}
