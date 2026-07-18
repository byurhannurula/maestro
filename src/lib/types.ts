/** A single track — the primary object in a track-first library. */
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  playCount: number;
  starred: boolean;
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
  source: DataSource;
  /** Present when source === "sample" because a live fetch failed. */
  error?: string;
}
