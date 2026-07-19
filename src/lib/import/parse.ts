/**
 * Parse a pasted/dropped import list into structured search targets.
 *
 * Real exports (Spotify / Exportify style) are messy:
 *   - multiple comma-separated artists:  "Ocean Park Standoff,Lil Yachty - If You Were Mine"
 *   - extra " - " inside the title:      "Finish Ticket - Color - Remastered"
 *   - feat. clutter:                     "... - Drink Water (feat. Jon Bellion and Fireboy DML)"
 *   - direct Deezer URLs
 *
 * Strategy: split on the FIRST " - " (artist | rest), take the first
 * comma-artist as primary, and build a Deezer-friendly search query with the
 * noisiest bits (feat / remaster tags) stripped. Remix info is preserved
 * because it changes the actual recording.
 */

export type ParsedLineKind = "query" | "url";

export interface ParsedLine {
  /** Original line, trimmed. */
  raw: string;
  kind: ParsedLineKind;
  /** Present when kind === "url". */
  url?: string;
  /** All artists parsed from the artist segment (empty for bare queries/URLs). */
  artists: string[];
  primaryArtist?: string;
  title?: string;
  /** The string to send to deemix/Deezer search. */
  searchQuery: string;
}

const SEP = " - ";

const isUrl = (s: string) => /^https?:\/\//i.test(s) || /(?:^|\.)deezer\.com\//i.test(s);

/** Remove "(feat. …)" / "ft. …" clutter that hurts exact search matching. */
function stripFeat(title: string): string {
  return title
    .replace(/\s*[([]\s*(?:feat|ft|featuring)\.?\s[^)\]]*[)\]]/gi, "")
    .replace(/\s+(?:feat|ft|featuring)\.\s.*$/i, "")
    .trim();
}

/** Drop trailing "- Remaster(ed) [year]" style suffixes (kept: remixes). */
function stripRemaster(title: string): string {
  return title.replace(/\s*-\s*(?:\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?$/i, "").trim();
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseImportLine(line: string): ParsedLine | null {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;

  if (isUrl(raw)) {
    return { raw, kind: "url", url: raw, artists: [], searchQuery: raw };
  }

  const sepIndex = raw.indexOf(SEP);
  if (sepIndex === -1) {
    // No separator — treat the whole line as a free-text search.
    return { raw, kind: "query", artists: [], title: raw, searchQuery: raw };
  }

  const artistPart = raw.slice(0, sepIndex).trim();
  const title = raw.slice(sepIndex + SEP.length).trim();

  const artists = artistPart
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const primaryArtist = artists[0];

  const titleForSearch = stripRemaster(stripFeat(title));
  const searchQuery = collapse(`${primaryArtist ?? ""} ${titleForSearch}`);

  return { raw, kind: "query", artists, primaryArtist, title, searchQuery };
}

export function parseImportList(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map(parseImportLine)
    .filter((l): l is ParsedLine => l !== null);
}
