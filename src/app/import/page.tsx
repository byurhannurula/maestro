"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseImportList } from "@/lib/parse-import";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function ImportPage() {
  const [text, setText] = useState("");
  const [playlist, setPlaylist] = useState("");
  const [dragging, setDragging] = useState(false);

  const parsed = useMemo(() => parseImportList(text), [text]);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const content = await file.text();
    setText((prev) => (prev ? `${prev}\n${content}` : content));
    toast.success(`Loaded ${file.name}`);
  }

  function startImport() {
    if (parsed.length === 0) return toast.error("Nothing to import");
    toast.info(
      `Queued ${parsed.length} track${parsed.length === 1 ? "" : "s"} → "${
        playlist || "no playlist"
      }" (pipeline lands in Phase 2)`,
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <PageHeader
        title="Import"
        subtitle="Paste or drop a list of songs. One per line — 'Artist - Title' or a Deezer URL."
        actions={
          <Button onClick={startImport} disabled={parsed.length === 0}>
            <Download className="size-4" /> Start import
          </Button>
        }
      />

      <div className="grid gap-6 px-6 pb-10 lg:grid-cols-2">
        {/* Input */}
        <div className="flex flex-col gap-3">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onFiles(e.dataTransfer.files);
            }}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors",
              dragging
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            <Upload className="size-4" />
            Drop a .txt / .csv here, or click to browse
            <input
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"Dua Lipa - IDGAF\nBUNT. - Crown\nTwo Door Cinema Club,RAC - Next Year (RAC Remix)"}
            className="h-80 w-full resize-none rounded-lg border border-border bg-card p-4 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="flex items-center gap-3">
            <Input
              value={playlist}
              onChange={(e) => setPlaylist(e.target.value)}
              placeholder="Target playlist (existing or new)…"
              className="max-w-xs"
            />
            <Badge variant="secondary">{parsed.length} parsed</Badge>
          </div>
        </div>

        {/* Preview */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-medium">
            <FileText className="size-4 text-muted-foreground" />
            Preview
          </div>
          {parsed.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
              Parsed rows appear here as you type or drop a file.
            </div>
          ) : (
            <div className="max-h-112 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Artist</th>
                    <th className="px-4 py-2 text-left font-medium">Title</th>
                    <th className="px-4 py-2 text-left font-medium">Search query</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="px-4 py-2">
                        {row.kind === "url" ? (
                          <Badge variant="outline">URL</Badge>
                        ) : (
                          row.primaryArtist ?? <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">{row.title ?? row.url}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {row.searchQuery}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
