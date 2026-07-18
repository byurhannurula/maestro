import type { Playlist, Song } from "./types";

/**
 * Sample library shown when Navidrome isn't configured yet, so the UI is
 * explorable out of the box. Replaced by live data once NAVIDROME_* env is set.
 */

interface Seed {
  title: string;
  artist: string;
  album: string;
  dur: number;
  plays: number;
  starred?: boolean;
  days: number; // days ago added
}

const seeds: Seed[] = [
  { title: "Insanity", artist: "BLESSED", album: "Insanity", dur: 198, plays: 0, days: 3 },
  { title: "Just Life", artist: "Jaguar Dreams", album: "Just Life", dur: 211, plays: 12, days: 40, starred: true },
  { title: "IDGAF", artist: "Dua Lipa", album: "Dua Lipa", dur: 217, plays: 87, days: 420, starred: true },
  { title: "Color", artist: "Finish Ticket", album: "Color", dur: 240, plays: 4, days: 210 },
  { title: "What I Want", artist: "The Band CAMINO", album: "What I Want", dur: 195, plays: 33, days: 120 },
  { title: "Monument", artist: "Mutemath", album: "Monument", dur: 262, plays: 51, days: 300 },
  { title: "If You Were Mine", artist: "Ocean Park Standoff", album: "If You Were Mine", dur: 188, plays: 0, days: 15 },
  { title: "Next Year (RAC Remix)", artist: "Two Door Cinema Club", album: "Next Year", dur: 274, plays: 9, days: 95 },
  { title: "Cold", artist: "Mating Ritual", album: "Cold", dur: 203, plays: 1, days: 260 },
  { title: "Genghis Khan (Louis the Child Remix)", artist: "Miike Snow", album: "Genghis Khan", dur: 231, plays: 22, days: 150 },
  { title: "White Wine & Adderall", artist: "The Chainsmokers", album: "White Wine & Adderall", dur: 199, plays: 5, days: 30 },
  { title: "Crown", artist: "BUNT.", album: "Crown", dur: 176, plays: 64, days: 70, starred: true },
  { title: "OLDER", artist: "Alexander Pappas", album: "OLDER", dur: 184, plays: 0, days: 8 },
  { title: "Shapeshifting", artist: "The Golf Club", album: "Shapeshifting", dur: 220, plays: 2, days: 340 },
  { title: "I Walk Alone", artist: "Oleander", album: "I Walk Alone", dur: 245, plays: 18, days: 500 },
  { title: "Batman & Robin", artist: "Louis Futon", album: "Batman & Robin", dur: 209, plays: 41, days: 180 },
  { title: "Typical", artist: "Mutemath", album: "Typical", dur: 250, plays: 73, days: 600, starred: true },
  { title: "thank god", artist: "Christian French", album: "thank god", dur: 191, plays: 0, days: 22 },
  { title: "Cottonwood", artist: "Twenty One Pilots", album: "Cottonwood", dur: 233, plays: 29, days: 60 },
  { title: "Comes Back Around", artist: "Kaskade", album: "Comes Back Around", dur: 214, plays: 11, days: 45 },
  { title: "You Need Jesus", artist: "BABY GRAVY", album: "You Need Jesus", dur: 167, plays: 3, days: 130 },
  { title: "Yeah The Girls", artist: "FISHER", album: "Yeah The Girls", dur: 226, plays: 56, days: 90 },
  { title: "The Sweet Escape", artist: "Gwen Stefani", album: "The Sweet Escape", dur: 246, plays: 0, days: 12 },
  { title: "Growing Old", artist: "Post Sex Nachos", album: "Growing Old", dur: 258, plays: 7, days: 280 },
  { title: "Take It Off", artist: "Keys N Krates", album: "Take It Off", dur: 201, plays: 1, days: 410 },
  { title: "Tommy Lee", artist: "Tyla Yaweh", album: "Tommy Lee", dur: 189, plays: 38, days: 200 },
  { title: "Melancholy", artist: "DOUBLECAMP", album: "Melancholy", dur: 178, plays: 0, days: 5 },
];

const DAY = 86_400_000;
// Fixed reference instant keeps sample data deterministic (no Date.now()).
const NOW = Date.parse("2026-07-18T00:00:00Z");

export const sampleSongs: Song[] = seeds.map((s, i) => ({
  id: `sample-${i + 1}`,
  title: s.title,
  artist: s.artist,
  album: s.album,
  durationSecs: s.dur,
  playCount: s.plays,
  starred: Boolean(s.starred),
  path: `/music/${s.artist} - ${s.album}/${s.title}.mp3`,
  createdAt: new Date(NOW - s.days * DAY).toISOString(),
  lastPlayed:
    s.plays > 0 ? new Date(NOW - Math.min(s.days, 30) * DAY).toISOString() : undefined,
}));

export const samplePlaylists: Playlist[] = [
  { id: "sample-pl-1", name: "Summer 2026", songCount: 30, durationSecs: 6400, public: false },
  { id: "sample-pl-2", name: "Shazam", songCount: 14, durationSecs: 2900, public: false },
  { id: "sample-pl-3", name: "explo weekly", songCount: 25, durationSecs: 5600, public: true },
];
