import type { Song, SongSortKey } from "@/lib/types";

export type ColId =
  | "title"
  | "artist"
  | "album"
  | "playCount"
  | "added"
  | "lastPlayed"
  | "duration";

export interface Col {
  id: ColId;
  sortKey: SongSortKey | null;
  label: string;
  align?: "right";
  width?: number;
}

export const COLUMNS: Col[] = [
  { id: "title", sortKey: "title", label: "Title", width: 240 },
  { id: "artist", sortKey: "artist", label: "Artist", width: 220 },
  { id: "album", sortKey: "album", label: "Album", width: 200 },
  { id: "playCount", sortKey: "playCount", label: "Plays", align: "right", width: 76 },
  { id: "added", sortKey: "createdAt", label: "Added", align: "right", width: 116 },
  { id: "lastPlayed", sortKey: "lastPlayed", label: "Last played", align: "right", width: 128 },
  { id: "duration", sortKey: null, label: "Time", align: "right", width: 66 },
];

export const TEXT_COLS = new Set<ColId>(["title", "artist", "album"]);
export const TOGGLEABLE: ColId[] = ["artist", "album", "playCount", "added", "lastPlayed", "duration"];
export const DEFAULT_DESC: SongSortKey[] = ["playCount", "createdAt", "lastPlayed"];

export const GRID: Record<ColId, string> = {
  title: "minmax(0, 3fr)",
  artist: "minmax(0, 1.6fr)",
  album: "minmax(0, 1.6fr)",
  playCount: "72px",
  added: "116px",
  lastPlayed: "128px",
  duration: "64px",
};

export const PAGE_SIZES = [25, 50, 100, 200, 500];
export const ROW_HEIGHT = 53;

export const STALE_OPTIONS: { days: number; label: string }[] = [
  { days: 0, label: "Any age" },
  { days: 7, label: "Over 7 days" },
  { days: 30, label: "Over 30 days" },
  { days: 90, label: "Over 90 days" },
  { days: 180, label: "Over 6 months" },
  { days: 365, label: "Over 1 year" },
];

export const staleLabel = (days: number) =>
  STALE_OPTIONS.find((o) => o.days === days)?.label ?? `Over ${days} days`;

export function textOf(col: Col, s: Song): string {
  if (col.id === "title") return s.title;
  if (col.id === "artist") return s.artist;
  if (col.id === "album") return s.album;
  return "";
}

export const RESPONSIVE_HIDE: { maxWidth: number; col: ColId }[] = [
  { maxWidth: 1280, col: "album" },
  { maxWidth: 1120, col: "added" },
  { maxWidth: 960, col: "lastPlayed" },
  { maxWidth: 760, col: "playCount" },
  { maxWidth: 520, col: "artist" },
];
