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

export type SongSortKey =
  | "title"
  | "artist"
  | "album"
  | "playCount"
  | "createdAt"
  | "lastPlayed";

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
