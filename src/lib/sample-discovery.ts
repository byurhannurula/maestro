/**
 * MOCKUP DATA for the Discovery page. None of this is live yet — it stands in
 * for what will eventually come from MusicBrainz / Last.fm "similar artists" and
 * "recommended tracks" endpoints, seeded from your own library. When wired up,
 * the "Add to queue" / "Send mix to deemix" actions will POST into the existing
 * import pipeline (see src/lib/import-worker.ts).
 */

export type RecoSource = "lastfm" | "musicbrainz";

/** A single recommended track — the unit you'd send to the download pipeline. */
export interface RecoTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  /** Why it surfaced, e.g. "Because you play Mutemath". */
  reason: string;
  source: RecoSource;
  /** 0–1 similarity/confidence, shown as a percent. */
  match: number;
  /** Already in the library — offer "In library" instead of a download. */
  inLibrary?: boolean;
}

/** A similar-artist suggestion, seeded from a top artist you already listen to. */
export interface RecoArtist {
  id: string;
  name: string;
  /** Seed artist this was derived from. */
  basedOn: string;
  /** Human-readable reach, purely cosmetic in the mockup. */
  listeners: string;
  tags: string[];
  source: RecoSource;
  /** How many of their tracks you already own. */
  libraryCount: number;
  /** Suggested tracks to grab if you like them. */
  topTracks: number;
}

/** A ready-made bundle you could send to deemix in one click. */
export interface RecoMix {
  id: string;
  title: string;
  subtitle: string;
  tracks: RecoTrack[];
}

export const recommendedTracks: RecoTrack[] = [
  {
    id: "rt-1",
    title: "Break the Same",
    artist: "MisterWives",
    album: "Our Own House",
    durationSecs: 224,
    reason: "Because you play The Band CAMINO",
    source: "lastfm",
    match: 0.94,
  },
  {
    id: "rt-2",
    title: "Electric Love",
    artist: "BØRNS",
    album: "Dopamine",
    durationSecs: 218,
    reason: "Fans of Two Door Cinema Club also play",
    source: "lastfm",
    match: 0.91,
  },
  {
    id: "rt-3",
    title: "Chlorine",
    artist: "Twenty One Pilots",
    album: "Trench",
    durationSecs: 265,
    reason: "More from Twenty One Pilots",
    source: "musicbrainz",
    match: 0.89,
    inLibrary: true,
  },
  {
    id: "rt-4",
    title: "Spirit Cold",
    artist: "Tash Sultana",
    album: "Flow State",
    durationSecs: 241,
    reason: "Similar to Mutemath",
    source: "lastfm",
    match: 0.87,
  },
  {
    id: "rt-5",
    title: "The Less I Know the Better",
    artist: "Tame Impala",
    album: "Currents",
    durationSecs: 216,
    reason: "Because you play Miike Snow",
    source: "musicbrainz",
    match: 0.86,
  },
  {
    id: "rt-6",
    title: "Sofia",
    artist: "Clairo",
    album: "Immunity",
    durationSecs: 187,
    reason: "Trending with listeners like you",
    source: "lastfm",
    match: 0.84,
  },
  {
    id: "rt-7",
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    durationSecs: 244,
    reason: "Fans of Kaskade also play",
    source: "lastfm",
    match: 0.82,
  },
  {
    id: "rt-8",
    title: "Feels Like We Only Go Backwards",
    artist: "Tame Impala",
    album: "Lonerism",
    durationSecs: 192,
    reason: "Similar to Mutemath",
    source: "musicbrainz",
    match: 0.8,
  },
];

export const similarArtists: RecoArtist[] = [
  {
    id: "ra-1",
    name: "COIN",
    basedOn: "The Band CAMINO",
    listeners: "1.4M",
    tags: ["indie pop", "synthpop"],
    source: "lastfm",
    libraryCount: 0,
    topTracks: 12,
  },
  {
    id: "ra-2",
    name: "Foster the People",
    basedOn: "Two Door Cinema Club",
    listeners: "3.1M",
    tags: ["indie", "alternative"],
    source: "lastfm",
    libraryCount: 2,
    topTracks: 18,
  },
  {
    id: "ra-3",
    name: "Glass Animals",
    basedOn: "Miike Snow",
    listeners: "2.7M",
    tags: ["psych pop", "electronic"],
    source: "musicbrainz",
    libraryCount: 1,
    topTracks: 15,
  },
  {
    id: "ra-4",
    name: "Bad Suns",
    basedOn: "Mutemath",
    listeners: "820K",
    tags: ["alt rock", "indie"],
    source: "lastfm",
    libraryCount: 0,
    topTracks: 9,
  },
  {
    id: "ra-5",
    name: "Vacationer",
    basedOn: "Louis Futon",
    listeners: "410K",
    tags: ["chillwave", "nu-disco"],
    source: "musicbrainz",
    libraryCount: 0,
    topTracks: 7,
  },
];

export const recommendedMixes: RecoMix[] = [
  {
    id: "mix-1",
    title: "Your Discover Weekly",
    subtitle: "20 tracks tuned to what you played this month",
    tracks: recommendedTracks.slice(0, 6),
  },
  {
    id: "mix-2",
    title: "Deep cuts from artists you love",
    subtitle: "Album tracks you don't own yet, from your top 10 artists",
    tracks: recommendedTracks.slice(2, 8),
  },
];
