"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePlayer } from "@/components/player-provider";
import { apiJson } from "@/hooks/use-api";
import { useToggleSet } from "@/hooks/use-toggle-set";
import { previewTrack } from "@/lib/player-track";
import { errMsg } from "@/lib/utils";
import type { DiscoveryArtist, DiscoveryTrack } from "@/lib/types";

export function useDiscovery({ lastfm }: { lastfm: boolean }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [tracksByMbid, setTracksByMbid] = useState<Record<string, DiscoveryTrack[]>>({});
  const [loadingMbid, setLoadingMbid] = useState<string | null>(null);

  const [recommended, setRecommended] = useState<DiscoveryTrack[] | null>(null);
  const [artists, setArtists] = useState<DiscoveryArtist[] | null>(null);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistTracks, setArtistTracks] = useState<Record<string, DiscoveryTrack[]>>({});
  const [loadingArtist, setLoadingArtist] = useState<string | null>(null);

  const queued = useToggleSet<string>();
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

  const loadRecommended = useCallback(async () => {
    setRecommended(null);
    setShowAllRec(false);
    try {
      const data = await apiJson<{ tracks?: DiscoveryTrack[] }>(
        "/api/discovery?recommended=1&refresh=1",
      );
      setRecommended(data.tracks ?? []);
    } catch {
      setRecommended([]);
    }
  }, []);

  const loadArtists = useCallback(async () => {
    setArtists(null);
    setExpandedArtist(null);
    try {
      const data = await apiJson<{ artists?: DiscoveryArtist[] }>(
        "/api/discovery?artists=1&refresh=1",
      );
      setArtists(data.artists ?? []);
    } catch {
      setArtists([]);
    }
  }, []);

  useEffect(() => {
    if (!lastfm) return;
    let alive = true;
    (async () => {
      try {
        const data = await apiJson<{ tracks?: DiscoveryTrack[] }>("/api/discovery?recommended=1");
        if (alive) setRecommended(data.tracks ?? []);
      } catch {
        if (alive) setRecommended([]);
      }
    })();
    (async () => {
      try {
        const data = await apiJson<{ artists?: DiscoveryArtist[] }>("/api/discovery?artists=1");
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
    player.toggle(previewTrack(t.id, t.title, t.preview, t.artist, t.cover));
  }

  function toggleQueue(t: DiscoveryTrack) {
    queued.toggle(t.id);
  }

  async function download() {
    const picked = [...queued.set]
      .map((id) => byId.get(id))
      .filter((t): t is DiscoveryTrack => !!t);
    if (picked.length === 0) return;
    setSending(true);
    try {
      const text = picked.map((t) => `${t.artist} - ${t.title}`).join("\n");
      await apiJson("/api/import", { method: "POST", body: JSON.stringify({ text }) });
      toast.success(`Sent ${picked.length} to deemix — track it on the Import page.`);
      queued.clear();
    } catch (e) {
      toast.error(`Download failed: ${errMsg(e)}`);
    } finally {
      setSending(false);
    }
  }

  const rowProps = (t: DiscoveryTrack) => ({
    playing: player.isCurrent(t.id) && player.playing,
    queued: queued.set.has(t.id),
    onPlay: () => togglePlay(t),
    onQueue: () => toggleQueue(t),
  });

  return {
    tracksByMbid,
    loadingMbid,
    recommended,
    artists,
    expandedArtist,
    artistTracks,
    loadingArtist,
    queued,
    sending,
    showAllRec,
    selectedId,
    setShowAllRec,
    loadRecommended,
    loadArtists,
    selectPlaylist,
    toggleArtist,
    download,
    rowProps,
  };
}
