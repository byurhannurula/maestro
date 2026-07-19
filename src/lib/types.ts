/** A single track — the primary object in a track-first library. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  playCount: number;
  starred: boolean;
  /** Cover-art id (album or song) for the /api/cover proxy, when known. */
  coverArt?: string;
  /** Zero-based position within the current playlist (only when playlist-scoped). */
  playlistIndex?: number;
  /** Absolute path inside the shared music volume, when known. */
  path?: string;
  /** ISO timestamps, when known. */
  createdAt?: string;
  lastPlayed?: string;
  /** Audio bitrate in kbps, when known (used to pick the best duplicate). */
  bitRate?: number;
  /** File size in bytes, when known. */
  sizeBytes?: number;
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  durationSecs: number;
  public: boolean;
}

/** Where a list of songs came from — drives the "not connected" UI banner. */
export type DataSource = "navidrome" | "sample";

export interface SongsResult {
  songs: Song[];
  /** Total matching rows in the library (for "N songs" + knowing when to stop). */
  total: number;
  source: DataSource;
  /** Present when source === "sample" because a live fetch failed. */
  error?: string;
}

export type SongSortKey = "title" | "artist" | "album" | "playCount" | "createdAt" | "lastPlayed";

/** A cluster of tracks that normalise to the same artist+title. */
export interface DuplicateGroup {
  /** Normalised grouping key (internal). */
  key: string;
  /** Display artist/title, taken from the suggested keeper. */
  artist: string;
  title: string;
  /** Members, suggested keeper first. */
  members: Song[];
  /** True when member durations span > a few seconds (likely different versions). */
  versionsDiffer: boolean;
  /** Bytes freed if every non-keeper copy is trashed. */
  reclaimableBytes: number;
}

export interface DuplicatesResult {
  groups: DuplicateGroup[];
  source: DataSource;
  /** Total tracks scanned. */
  scanned: number;
  /** Total tracks that sit inside a duplicate group. */
  duplicateTracks: number;
  error?: string;
}

export interface SongQuery {
  start: number;
  /** Exclusive end index; page size = end - start. */
  end: number;
  sort: SongSortKey;
  order: "ASC" | "DESC";
  /** Free-text search across title/artist/album. */
  search?: string;
  /** Scope to a single playlist's tracks. */
  playlistId?: string;
  /** Only starred/favourited tracks. */
  favoritesOnly?: boolean;
  /** Cleanup: only never-played tracks (playCount 0). */
  unplayedOnly?: boolean;
  /** Cleanup age cutoff (days): hide never-played tracks added more recently
   *  than this, so fresh imports aren't flagged as dead weight. 0/undefined = off. */
  staleDays?: number;
}

/** A recommendation playlist surfaced on Discovery (from ListenBrainz). */
export interface DiscoveryPlaylist {
  /** ListenBrainz playlist MBID (fetch its tracks by this). Empty when unavailable. */
  mbid: string;
  /** Short category, e.g. "Weekly Exploration" / "Weekly Jams" / "Daily Jams". */
  kind: string;
  /** Full ListenBrainz title (tooltip). */
  title: string;
  /** Friendly one-liner shown on the card. */
  subtitle: string;
  /** False = a canonical slot ListenBrainz hasn't generated for this user (greyed). */
  available: boolean;
}

/** A single Discovery track, enriched with a Deezer preview + library match. */
export interface DiscoveryTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSecs?: number;
  /** 30-second preview MP3 (Deezer); absent when unavailable. */
  preview?: string;
  /** Cover art URL (Deezer). */
  cover?: string;
  deezerUrl?: string;
  /** Found on Deezer → downloadable via deemix. */
  available: boolean;
  /** Already in the Navidrome library. */
  inLibrary: boolean;
  /** 0–1 similarity (Last.fm recommendations only). */
  match?: number;
  /** Why it surfaced, e.g. "Similar to Mutemath" (Last.fm only). */
  reason?: string;
}

/** A similar-artist suggestion (Last.fm), seeded from an artist you play. */
export interface DiscoveryArtist {
  id: string;
  name: string;
  /** Seed artist this was derived from. */
  basedOn: string;
  /** 0–1 similarity. */
  match: number;
  /** Already have tracks by this artist. */
  inLibrary: boolean;
}
