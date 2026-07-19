"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Library,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePlayer } from "@/components/player-provider";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/hooks/use-api";
import { coverGradient } from "@/lib/cover-gradient";
import { formatDuration } from "@/lib/format";
import { cn, errMsg } from "@/lib/utils";
import type { DiscoveryArtist, DiscoveryPlaylist, DiscoveryTrack } from "@/lib/types";

export function DiscoveryView({
  configured,
  lastfm,
  playlists,
}: {
  configured: boolean;
  lastfm: boolean;
  playlists: DiscoveryPlaylist[];
}) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [tracksByMbid, setTracksByMbid] = useState<Record<string, DiscoveryTrack[]>>({});
  const [loadingMbid, setLoadingMbid] = useState<string | null>(null);

  const [recommended, setRecommended] = useState<DiscoveryTrack[] | null>(null);
  const [artists, setArtists] = useState<DiscoveryArtist[] | null>(null);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistTracks, setArtistTracks] = useState<Record<string, DiscoveryTrack[]>>({});
  const [loadingArtist, setLoadingArtist] = useState<string | null>(null);

  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [showAllRec, setShowAllRec] = useState(false);
  const player = usePlayer();

  const byId = useMemo(() => {
    const m = new Map<string, DiscoveryTrack>();
    const add = (list?: DiscoveryTrack[] | null) => {
      if (list) for (const t of list) m.set(t.id, t);
    };
    for (const list of Object.values(tracksByMbid)) add(list);
    add(recommended);
    for (const list of Object.values(artistTracks)) add(list);
    return m;
  }, [tracksByMbid, recommended, artistTracks]);

  // Reload with fresh (shuffled-seed) picks — used by the section reload buttons.
  const loadRecommended = useCallback(async () => {
    setRecommended(null);
    setShowAllRec(false);
    try {
      const res = await fetch("/api/discovery?recommended=1&refresh=1");
      const data = await res.json().catch(() => ({}));
      setRecommended(data.tracks ?? []);
    } catch {
      setRecommended([]);
    }
  }, []);

  const loadArtists = useCallback(async () => {
    setArtists(null);
    setExpandedArtist(null);
    try {
      const res = await fetch("/api/discovery?artists=1&refresh=1");
      const data = await res.json().catch(() => ({}));
      setArtists(data.artists ?? []);
    } catch {
      setArtists([]);
    }
  }, []);

  // Lazy-load the Last.fm sections after first paint (inline so no setState runs
  // synchronously inside the effect).
  useEffect(() => {
    if (!lastfm) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/discovery?recommended=1");
        const data = await res.json().catch(() => ({}));
        if (alive) setRecommended(data.tracks ?? []);
      } catch {
        if (alive) setRecommended([]);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/discovery?artists=1");
        const data = await res.json().catch(() => ({}));
        if (alive) setArtists(data.artists ?? []);
      } catch {
        if (alive) setArtists([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lastfm]);

  async function fetchTracks(qs: string): Promise<DiscoveryTrack[] | null> {
    try {
      const data = await apiJson<{ tracks?: DiscoveryTrack[] }>(`/api/discovery?${qs}`);
      return data.tracks ?? null;
    } catch (e) {
      toast.error(`Discovery: ${errMsg(e)}`);
      return null;
    }
  }

  async function selectPlaylist(mbid: string) {
    if (selectedId === mbid) return setSelectedId("");
    setSelectedId(mbid);
    if (tracksByMbid[mbid]) return;
    setLoadingMbid(mbid);
    const t = await fetchTracks(`playlist=${encodeURIComponent(mbid)}`);
    if (t) setTracksByMbid((m) => ({ ...m, [mbid]: t }));
    setLoadingMbid(null);
  }

  async function toggleArtist(a: DiscoveryArtist) {
    if (expandedArtist === a.name) return setExpandedArtist(null);
    setExpandedArtist(a.name);
    if (artistTracks[a.name]) return;
    setLoadingArtist(a.name);
    const t = await fetchTracks(`artist=${encodeURIComponent(a.name)}`);
    if (t) setArtistTracks((m) => ({ ...m, [a.name]: t }));
    setLoadingArtist(null);
  }

  function togglePlay(t: DiscoveryTrack) {
    if (!t.preview) return;
    // Proxy the Deezer clip through our origin — the CDN blocks direct
    // cross-origin playback (CORB).
    player.toggle({
      id: t.id,
      title: t.title,
      artist: t.artist,
      src: `/api/preview?url=${encodeURIComponent(t.preview)}`,
      coverUrl: t.cover,
      source: "preview",
    });
  }

  function toggleQueue(t: DiscoveryTrack) {
    setQueued((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      return next;
    });
  }

  async function download() {
    const picked = [...queued].map((id) => byId.get(id)).filter((t): t is DiscoveryTrack => !!t);
    if (picked.length === 0) return;
    setSending(true);
    try {
      const text = picked.map((t) => `${t.artist} - ${t.title}`).join("\n");
      await apiJson("/api/import", { method: "POST", body: JSON.stringify({ text }) });
      toast.success(`Sent ${picked.length} to deemix — track it on the Import page.`);
      setQueued(new Set());
    } catch (e) {
      toast.error(`Download failed: ${errMsg(e)}`);
    } finally {
      setSending(false);
    }
  }

  const rowProps = (t: DiscoveryTrack) => ({
    playing: player.isCurrent(t.id) && player.playing,
    queued: queued.has(t.id),
    onPlay: () => togglePlay(t),
    onQueue: () => toggleQueue(t),
  });

  if (!configured && !lastfm) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6 text-center">
          <Music2 className="mx-auto mb-3 size-6 text-muted-foreground" />
          <h2 className="text-base font-semibold">Discovery isn&apos;t configured yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code className="rounded bg-muted px-1">LISTENBRAINZ_USER</code> (weekly mixes)
            and/or <code className="rounded bg-muted px-1">LASTFM_API_KEY</code> (recommended tracks
            &amp; artists) to light this up. No extra accounts needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="space-y-8 px-4 pb-28 pt-4 sm:px-6">
        {/* ── ListenBrainz mixes ─────────────────────────────────────── */}
        {configured && playlists.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Your mixes
            </h2>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {playlists.map((pl) => {
                const active = pl.mbid === selectedId;
                const disabled = !pl.available;
                return (
                  <button
                    key={pl.kind}
                    onClick={() => !disabled && selectPlaylist(pl.mbid)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-expanded={active}
                    title={disabled ? "Not generated for you yet" : pl.title}
                    className={cn(
                      "group relative flex aspect-square w-52 shrink-0 flex-col justify-between overflow-hidden rounded-xl border p-3 text-left transition-colors",
                      disabled
                        ? "cursor-default border-border"
                        : active
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:border-border/60",
                    )}
                  >
                    <div
                      aria-hidden
                      className={cn(
                        "absolute inset-0 -z-10 bg-linear-to-br",
                        disabled
                          ? "from-muted to-background opacity-70"
                          : cn("opacity-90", coverGradient(pl.kind)),
                      )}
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 -z-10 bg-linear-to-t from-black/80 via-black/20 to-black/10"
                    />
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        disabled ? "text-muted-foreground" : "text-white/70",
                      )}
                    >
                      ListenBrainz
                    </span>
                    <div>
                      <div
                        className={cn(
                          "text-sm font-bold uppercase leading-tight",
                          disabled ? "text-muted-foreground" : "text-white",
                        )}
                      >
                        {pl.kind}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 line-clamp-2 text-[10px]",
                          disabled ? "text-muted-foreground/70" : "text-white/70",
                        )}
                      >
                        {disabled ? "Not generated yet" : pl.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedId && (
              <div className="pt-1">
                {loadingMbid === selectedId && !tracksByMbid[selectedId] ? (
                  <Loading label="Loading tracks & previews…" />
                ) : tracksByMbid[selectedId]?.length ? (
                  <TrackList tracks={tracksByMbid[selectedId]} rowProps={rowProps} />
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No tracks in this mix.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Last.fm recommended tracks ─────────────────────────────── */}
        {lastfm && (
          <section className="space-y-3">
            <SectionHeading
              title="Recommended tracks"
              hint="Similar to what you play the most"
              onReload={() => loadRecommended()}
              reloading={recommended === null}
            />
            {recommended === null ? (
              <Loading label="Finding recommendations…" />
            ) : recommended.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet — play a bit more of your library so we have seeds to work from.
              </p>
            ) : (
              <div>
                <div
                  className="relative overflow-hidden transition-[max-height] duration-500 ease-in-out"
                  style={{ maxHeight: showAllRec ? recommended.length * 96 + 40 : 360 }}
                >
                  <TrackList tracks={recommended} rowProps={rowProps} />
                  {/* Decorative bottom fade only — no pointer capture, so every
                      visible row stays clickable. */}
                  {!showAllRec && recommended.length > 5 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent" />
                  )}
                </div>
                {recommended.length > 5 && (
                  <div className="flex justify-center pt-2">
                    <ShowMore onClick={() => setShowAllRec((v) => !v)}>
                      {showAllRec ? "Show less" : `Show all ${recommended.length}`}
                    </ShowMore>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Last.fm artists to explore ─────────────────────────────── */}
        {lastfm && (
          <section className="space-y-3">
            <SectionHeading
              title="Artists to explore"
              hint="Similar to the artists you own"
              onReload={() => loadArtists()}
              reloading={artists === null}
            />
            {artists === null ? (
              <Loading label="Finding artists…" />
            ) : artists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {artists.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleArtist(a)}
                      className={cn(
                        "flex items-center gap-3.5 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/30",
                        expandedArtist === a.name ? "border-primary" : "border-border",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-base font-semibold text-white/90",
                          coverGradient(a.id),
                        )}
                      >
                        {a.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{a.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Similar to {a.basedOn}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                            {Math.round(a.match * 100)}%
                          </span>
                          {a.inLibrary && (
                            <span className="inline-flex items-center gap-1">
                              <Library className="size-2.5" /> owned
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {expandedArtist === a.name ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        <Sparkles className="size-3.5" />
                      </span>
                    </button>
                  ))}
                </div>

                {expandedArtist && (
                  <div className="rounded-xl border border-border p-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      {expandedArtist} — top tracks
                    </div>
                    {loadingArtist === expandedArtist && !artistTracks[expandedArtist] ? (
                      <Loading label="Loading top tracks…" />
                    ) : artistTracks[expandedArtist]?.length ? (
                      <TrackList tracks={artistTracks[expandedArtist]} rowProps={rowProps} />
                    ) : (
                      <p className="py-4 text-sm text-muted-foreground">No tracks found.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Download bar */}
      {queued.size > 0 && (
        <div className="pointer-events-none sticky inset-x-0 bottom-6 flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
            <span className="px-2 text-sm font-medium tabular-nums">{queued.size} selected</span>
            <div className="mx-1 h-5 w-px bg-border" />
            <Button size="sm" onClick={download} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Download to deemix
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setQueued(new Set())}
              disabled={sending}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShowMore({
  onClick,
  className,
  children,
}: {
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SectionHeading({
  title,
  hint,
  onReload,
  reloading,
}: {
  title: string;
  hint: string;
  onReload?: () => void;
  reloading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <span className="hidden text-xs text-muted-foreground/70 sm:inline">{hint}</span>
      </div>
      {onReload && (
        <button
          onClick={onReload}
          disabled={reloading}
          title="Show a different batch"
          aria-label="Shuffle"
          className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", reloading && "animate-spin")} />
        </button>
      )}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

function TrackList({
  tracks,
  rowProps,
}: {
  tracks: DiscoveryTrack[];
  rowProps: (t: DiscoveryTrack) => {
    playing: boolean;
    queued: boolean;
    onPlay: () => void;
    onQueue: () => void;
  };
}) {
  return (
    <div className="flex flex-col">
      {tracks.map((t, i) => (
        <TrackRow key={`${t.id}-${i}`} track={t} index={i} {...rowProps(t)} />
      ))}
    </div>
  );
}

function TrackRow({
  track: t,
  index,
  playing,
  queued,
  onPlay,
  onQueue,
}: {
  track: DiscoveryTrack;
  index: number;
  playing: boolean;
  queued: boolean;
  onPlay: () => void;
  onQueue: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 border-b border-border/40 py-2 last:border-0">
      <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {index + 1}
      </span>

      {/* Cover doubles as the preview play/pause button when a clip exists. */}
      <button
        onClick={onPlay}
        disabled={!t.preview}
        aria-label={t.preview ? (playing ? "Pause preview" : "Play preview") : "No preview"}
        className="relative size-11 shrink-0 overflow-hidden rounded"
      >
        {t.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-linear-to-br",
              coverGradient(t.id),
            )}
          >
            <Music2 className="size-4 text-white/80" />
          </div>
        )}
        {t.preview && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              playing ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white">
              {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
            </span>
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{t.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {t.artist}
          {t.album ? ` — ${t.album}` : ""}
        </div>
        {t.reason && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
            {t.match != null && (
              <span className="font-medium text-primary">{Math.round(t.match * 100)}%</span>
            )}
            <span className="truncate">{t.reason}</span>
          </div>
        )}
      </div>

      {t.durationSecs != null && (
        <span className="hidden w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:inline">
          {formatDuration(t.durationSecs)}
        </span>
      )}

      {t.inLibrary ? (
        <span className="inline-flex w-28 shrink-0 items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground">
          <Library className="size-3" /> In library
        </span>
      ) : !t.available ? (
        <span className="inline-flex w-28 shrink-0 items-center justify-end text-[11px] text-muted-foreground/60">
          Not on Deezer
        </span>
      ) : (
        <Button
          size="xs"
          variant={queued ? "secondary" : "outline"}
          className="w-28 shrink-0"
          onClick={onQueue}
          aria-pressed={queued}
        >
          {queued ? (
            <>
              <Check className="size-3" /> Selected
            </>
          ) : (
            <>
              <Plus className="size-3" /> Download
            </>
          )}
        </Button>
      )}
    </div>
  );
}
