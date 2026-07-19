"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Disc3,
  Info,
  Library,
  Music2,
  Plus,
  Radio,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type {
  RecoArtist,
  RecoMix,
  RecoSource,
  RecoTrack,
} from "@/lib/sample-discovery";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Deterministic cover gradient so the same track always looks the same. */
const COVERS = [
  "from-emerald-500/40 to-teal-600/30",
  "from-violet-500/40 to-fuchsia-600/30",
  "from-sky-500/40 to-indigo-600/30",
  "from-amber-500/40 to-orange-600/30",
  "from-rose-500/40 to-pink-600/30",
  "from-lime-500/40 to-emerald-600/30",
  "from-cyan-500/40 to-blue-600/30",
];
function coverFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COVERS[Math.abs(h) % COVERS.length];
}

function SourceBadge({ source }: { source: RecoSource }) {
  return (
    <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
      <Radio className="size-2.5" />
      {source === "lastfm" ? "Last.fm" : "MusicBrainz"}
    </Badge>
  );
}

export function DiscoveryView({
  tracks,
  artists,
  mixes,
}: {
  tracks: RecoTrack[];
  artists: RecoArtist[];
  mixes: RecoMix[];
}) {
  const [queued, setQueued] = useState<Set<string>>(new Set());

  const queuedTracks = useMemo(
    () => tracks.filter((t) => queued.has(t.id)),
    [tracks, queued],
  );

  function toggleQueue(t: RecoTrack) {
    setQueued((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      return next;
    });
  }

  function sendQueue() {
    toast.info(
      `Preview only — would send ${queuedTracks.length} track${queuedTracks.length === 1 ? "" : "s"} to the deemix pipeline.`,
    );
    setQueued(new Set());
  }

  function sendMix(mix: RecoMix) {
    toast.info(`Preview only — would queue "${mix.title}" (${mix.tracks.length} tracks) to deemix.`);
  }

  function queueArtist(a: RecoArtist) {
    toast.info(`Preview only — would fetch ${a.topTracks} top tracks from ${a.name} via ${a.source === "lastfm" ? "Last.fm" : "MusicBrainz"}.`);
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="space-y-10 px-6 pb-28 pt-2">
        {/* Preview notice — this whole page is a mockup for now. */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <p className="text-muted-foreground">
            <span className="font-medium text-amber-300">Preview.</span> Recommendations
            here are sample data. Once wired up, they&apos;ll be seeded from your library via{" "}
            <span className="font-medium text-foreground">Last.fm</span> and{" "}
            <span className="font-medium text-foreground">MusicBrainz</span>, and the download
            actions will feed the existing deemix import pipeline.
          </p>
        </div>

        {/* Ready-made mixes */}
        <section className="space-y-3">
          <SectionHeading icon={Sparkles} title="Made for you" hint="Send a whole mix to the pipeline in one click" />
          <div className="grid gap-4 sm:grid-cols-2">
            {mixes.map((mix) => (
              <div
                key={mix.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5"
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gradient-to-br opacity-70 blur-2xl transition-opacity group-hover:opacity-100",
                    coverFor(mix.id),
                  )}
                />
                <div className="relative">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Disc3 className="size-5" />
                  </div>
                  <h3 className="text-base font-semibold">{mix.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{mix.subtitle}</p>
                </div>
                <div className="relative mt-5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {mix.tracks.length} tracks
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => sendMix(mix)}>
                    <Send className="size-3.5" /> Send to deemix
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recommended tracks */}
        <section className="space-y-3">
          <SectionHeading icon={TrendingUp} title="Recommended tracks" hint="Picked from what you play the most" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tracks.map((t) => {
              const isQueued = queued.has(t.id);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-border/80 hover:bg-muted/30"
                >
                  <div
                    className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                      coverFor(t.id),
                    )}
                  >
                    <Music2 className="size-5 text-white/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatDuration(t.durationSecs)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {Math.round(t.match * 100)}% match
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground" title={t.reason}>
                        {t.reason}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <SourceBadge source={t.source} />
                    {t.inLibrary ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Library className="size-3" /> In library
                      </span>
                    ) : (
                      <Button
                        size="xs"
                        variant={isQueued ? "secondary" : "outline"}
                        onClick={() => toggleQueue(t)}
                        aria-pressed={isQueued}
                        aria-label={isQueued ? `Remove ${t.title} from queue` : `Add ${t.title} to queue`}
                      >
                        {isQueued ? (
                          <>
                            <Check className="size-3" /> Queued
                          </>
                        ) : (
                          <>
                            <Plus className="size-3" /> Queue
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Similar artists */}
        <section className="space-y-3">
          <SectionHeading icon={Radio} title="Artists to explore" hint="Similar to the artists you already own" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {artists.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30"
              >
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white/90",
                    coverFor(a.name),
                  )}
                >
                  {a.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Similar to {a.basedOn}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {a.tags.map((tag) => (
                      <span key={tag} className="rounded bg-muted px-1.5 py-0.5">
                        {tag}
                      </span>
                    ))}
                    <span className="tabular-nums">{a.listeners} listeners</span>
                    {a.libraryCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Library className="size-2.5" /> {a.libraryCount} in library
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  className="shrink-0 self-start text-muted-foreground"
                  onClick={() => queueArtist(a)}
                >
                  <Sparkles className="size-3" /> Top tracks
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Queue action bar */}
      {queuedTracks.length > 0 && (
        <div className="pointer-events-none sticky inset-x-0 bottom-6 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium tabular-nums">
              {queuedTracks.length} queued
            </span>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button size="sm" onClick={sendQueue}>
              <Send className="size-4" /> Send to deemix
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setQueued(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" />
        {title}
      </h2>
      <span className="hidden text-xs text-muted-foreground/70 sm:inline">{hint}</span>
    </div>
  );
}
