# PRD: Navidrome Organizer

*A self-hosted, **track-first** companion app for bulk importing, organizing, and cleaning up a Navidrome library. Not a player — a manager.*

**In one line:** a thin layer over **deemix + Navidrome**.
- The **deemix side** does one thing: download many songs at once, by name, from a pasted/dropped list.
- The **Navidrome side** is better organizing, sorting, bulk actions, and an overall look at the whole system's health.
- Plus direct sight into the `./music` folder, with delete from the UI — the one thing Navidrome refuses to do.

## 1. Problem

Byurhan's library (~3-4k tracks, **mostly single tracks from many different artists, not full albums**) is painful to manage with existing tools:

- **Every client is album-centric.** In Feishin (and the Navidrome web UI), clicking a song throws you to its *album page*, then you drill into the album, then the track. Since almost every "album" here is a single with one track, that's three clicks of friction to touch one song. This is baked into Subsonic's data model — a single is just an album with one track — so no ready-made client escapes it.
- **Import is manual.** Adding music means finding each track in deemix's web UI one at a time, then hunting it down in Navidrome afterward to add it to a playlist.
- **No fast way to find dead weight.** With thousands of tracks and inconsistent listening, there's no quick "what have I never played" view to clear out.
- **Navidrome won't touch files.** By design it mounts `./music` read-only and never writes, so cleanup must happen outside it.

## 2. Goals

1. **Be track-first.** The primary object is the *track*; the primary containers are *All Songs* and *Playlists*. The app never renders an album page. This is the core reason it exists.
2. Turn "here's a list of 30 song names" into "downloaded, in Navidrome, and in the right playlist" with minimal manual steps.
3. Give a fast, flat, bulk-action song table (sort/filter by play count, date added, etc.) that no album-centric client offers.
4. Make deleting unwanted/unlistened tracks a safe batch operation instead of a one-by-one chore.
5. Keep playlist curation (add/remove/favorite/reorder) fast for a single-track, cross-artist workflow.
6. Give one overall view of system health — is deemix reachable, is Deezer available, is Navidrome scanning, how big is the library/trash — so the whole stack can be checked at a glance.
7. Expose the `./music` folder directly (browse the real files) and allow deleting from the UI, since Navidrome won't.

## 3. Non-goals

- **Not a playback client.** Streaming/playing stays in Feishin, the Navidrome web UI, or a mobile app. No player bar in this app.
- **Not an album browser.** Album and Artist *pages* are deliberately absent; artist/album are filter facets on the song table, not things you navigate into.
- **Not a metadata/tag editor.** beets can cover that later if set up; out of scope here.
- **Not replacing explo.** explo keeps downloading weekly recommendations and creating its weekly Navidrome playlist — this app complements it.
- **Not public/multi-user.** Single admin user, LAN/tunnel-only.

## 4. Users

Just Byurhan, self-hosted on a small homelab PC, accessed from a Mac browser (optionally a Tauri wrapper later). Auth only as needed to protect an internet-adjacent service (basic auth or Cloudflare Access, consistent with the `blab.party` stack).

## 5. System context

```
                 ┌──────────────┐
   paste/drop ──▶ │   Organizer   │ ──▶ deemix webui REST API (search + queue downloads)
   txt/csv list   │   (this app)  │
                 │  track-first  │ ──▶ Navidrome Subsonic API (/rest/*)  [stable]
                 │  Next.js/TS   │ ──▶ Navidrome Native API (/api/*)     [sorting only, unstable]
                 └──────┬────────┘
                        │
                 SQLite (import job history)
                        │
        shared ./music (rw for delete)  +  ./trash (rw)
```

New service in the existing docker-compose stack, on the same network as navidrome / deemix / feishin / explo / beets. It talks to:

- **deemix webui REST API** — the `bambanah/deemix` webui Express server exposes a real JSON API (see §6.1). Used to search Deezer and queue single-track downloads. **No devtools reverse-engineering needed — the endpoints are known.**
- **Navidrome Subsonic API** (`/rest/*`) — stable, versioned. Used for search, star/unstar, playlist CRUD, and triggering scans. The workhorse.
- **Navidrome Native REST API** (`/api/*`) — *only* for the sortable/filterable flat song list with play counts, which Subsonic doesn't serve well. Explicitly unstable across versions — **isolate all `/api/*` calls behind one client module** so a Navidrome upgrade break is a one-file fix. Pin the Navidrome image version.
- **Filesystem** — `./music` mounted read-write for delete; a sibling `./trash` folder outside the Navidrome-scanned tree as the delete destination.

## 6. Features

### 6.1 Bulk Import (Download → Organize pipeline)

**Input:** A textarea/paste or **drag-drop of a `.txt`/`.csv`** file, one song per line (`Artist - Title`, or Deezer track URLs), plus a target playlist (existing or new-by-name).

**Line parsing (matters — real export files are messy):** The Spotify/Exportify-style exports used here contain multiple comma-separated artists (`Ocean Park Standoff,Lil Yachty - If You Were Mine`), extra ` - ` inside titles (`Finish Ticket - Color - Remastered`), and `(feat. …)` clutter. Parse by splitting on the **first** ` - ` (artist | rest), take the first comma-artist as primary, and hand the pieces to Deezer search — its fuzzy top-result handles remasters/features. CSV (Exportify) is the same idea with columns.

**deemix REST API (from `bambanah/deemix` webui, confirmed in source):**

| Endpoint | Use |
|---|---|
| `POST /api/loginArl` `{arl}` | One-time login with the Deezer ARL |
| `GET /api/connect` | Health/session check; exposes `deezerAvailable`, `spotifyEnabled` — used to fail loudly when Deezer is down |
| `GET /api/search?type=track&term=<q>&nb=10&start=0` | Resolve a text line to Deezer tracks (id + link) |
| `GET /api/mainSearch?term=<q>` | Combined search with a `TOP_RESULT` best match |
| `POST /api/addToQueue` `{url, bitrate}` | Queue a download. `url` accepts multiple space/`;`-separated URLs |
| `GET /api/getQueue` | Poll queue + per-item progress |
| websocket (`socket.io`) | Live download progress events (push instead of poll) |

**Queue single tracks, not playlists.** The app resolves each line to a single Deezer *track* URL and queues that. It does **not** queue Deezer playlist URLs. This avoids deemix's per-playlist folder duplication (the same song copied into every playlist folder) — the organizer owns playlist membership inside Navidrome instead.

**Pipeline (per song):**

| Step | Action | Failure handling |
|---|---|---|
| 1. Search | `GET /api/search` for the line, pick best track match | No result → `not_found`, surface in UI, stop |
| 2. Queue | `POST /api/addToQueue` with the track URL | — |
| 3. Download | Watch websocket / poll `getQueue` until complete | Timeout after N min → `download_failed` |
| 4. Scan | Trigger Navidrome `startScan`, poll `getScanStatus` | **Batch** — one scan per completed batch, not per song |
| 5. Match | Subsonic `search3` for artist+title, take best match | No confident match → `needs_review`, show candidates for manual pick |
| 6. Add to playlist | Subsonic `updatePlaylist` with matched song ID | Retry once → `add_failed` |

**UI:** A status table, one row per submitted line, live-updating (`queued → downloading → scanning → matched → added` / `failed: <reason>`). Failed/ambiguous rows get inline actions (retry, manually pick a match, skip).

**Concurrency / rate limiting:** Deezer bans aggressive patterns. Run the pipeline as an **in-process sequential worker with a fixed delay between deemix calls** (a simple `await sleep(n)` — no BullMQ/Redis needed for one user). Don't parallelize the download step.

### 6.2 Library Browser — the default landing screen

A single **flat, sortable/filterable song table** over the whole library. **This is what opens when you launch the app.**

- Backed by the Native API (`/api/song`) for the sortable columns; Subsonic for actions.
- Columns: title, artist, **album as plain text (not a clickable page)**, play count, date added, last played, favorite ♥.
- Default-useful views/filters: "Never played," "Not played in 90+ days," "Recently added."
- Free-text search; artist/album act as *filters*, never as drill-down navigation.
- Row + multi-select → bulk actions: **add to playlist, favorite/unfavorite, delete**.

### 6.3 Playlist Management

- List all playlists with track counts (Spotify-like sidebar).
- Open a playlist → flat, reorderable track list; remove tracks; add tracks via search-as-you-type that returns **individual tracks, not albums**.
- Inline favorite toggle — tuned for single-track curation.

### 6.4 Cleanup / Delete — move to trash, not destroy

Since Navidrome never touches files, the app deletes directly, safely:

1. Select tracks (from the Library Browser or a stale-finder view).
2. Confirmation step showing the **exact file paths** about to be moved (no silent bulk delete).
3. App **moves** the files from `./music` to a sibling **`./trash`** folder outside the Navidrome-scanned tree (recoverable by hand). No hard delete in v1; no auto-purge, no in-app restore view (deferred — see §9).
4. App triggers a Navidrome rescan with purge-missing so orphaned DB rows and playlist entries clear automatically. **Verify this scanner setting on the pinned Navidrome version.**

**Stale-finder:** Navidrome's built-in **smart playlists** already express "play count < 2, sort by date added" natively (seen in Feishin's Query Editor). Prefer defining the stale set as a Navidrome smart playlist the app reads, rather than reinventing the query.

### 6.5 System Overview — check the whole stack at a glance

A single dashboard screen answering "is everything OK?" across the two systems this app sits on top of:

- **deemix:** reachable? logged in (ARL valid)? `deezerAvailable`? current queue length / active downloads (from `GET /api/connect` + `GET /api/getQueue`).
- **Navidrome:** reachable? scanning now or idle, last scan time, library counts — songs / playlists / starred (Subsonic `getScanStatus`, `getPlaylists`, plus the Native song count).
- **Storage:** `./music` size and free disk; `./trash` size (so it's obvious when trash needs clearing).
- **Recent imports:** last few import batches and their outcomes, linking into the §6.1 status table.

Read-only, at-a-glance. This is the "overall checking whole system" surface — one place to confirm the stack is healthy before/after an import or cleanup.

### 6.6 Music Folder Browser — see the real files, delete directly

A view onto the actual `./music` volume (read-write mount), complementing the tag-based Library Browser (§6.2) which shows Navidrome's *indexed* view:

- Navigate the real folder tree (`./music` and subfolders, incl. `./music/explo`).
- Per file/folder: name, size, modified date; optional "is this indexed by Navidrome?" flag by cross-referencing paths.
- Actions: **move to `./trash`** (same safe delete as §6.4 — never hard-delete in v1), then trigger a purge-rescan.
- Useful for the mess that the tag view can't explain: orphaned files, stray downloads, duplicate folders, leftovers explo/deemix dropped that aren't cleanly tagged.

This is the escape hatch for "something's wrong on disk that Navidrome's clean index hides." Delete flow is identical to §6.4 (confirmation showing exact paths → move to trash → rescan).

### 6.7 Webhook / external ingest *(future)*

A headless entry point into the §6.1 import pipeline, so external triggers can queue downloads without the UI:

- **Endpoint:** `POST /api/webhook/import` with a shared-secret / Cloudflare Access service token in the header, body `{ artist, title }` (or a raw `"Artist - Title"` line) plus an optional target playlist name (default e.g. `Shazam`).
- **Behaviour:** creates one `import_job` targeting the named playlist (created if missing) and runs the exact same pipeline — resolve → deemix → scan → match → add. Ambiguous matches still land in `needs_review` for later manual pick in the UI.
- **Canonical use — Shazam → iOS Shortcut:** Shazam identifies a song → an iOS Shortcut (Automation or Share Sheet) reads `artist + title` → POSTs to the webhook → the track auto-downloads and lands in the `Shazam` playlist.
- **Reachability:** relies on the existing Cloudflare tunnel/Access in front of the stack so the phone can reach the app from anywhere; the Shortcut carries the token.

This is purely additive — the pipeline is the reusable core; the webhook is just a second producer alongside the paste/drop UI.

## 7. Data model (app's own DB — SQLite)

Navidrome stays the source of truth for library data. The app persists only import-job history for the status view:

```
import_batch
  id, created_at, target_playlist_id, target_playlist_name (if new)

import_job
  id, batch_id, raw_input_line, parsed_artist, parsed_title,
  status, deemix_queue_id, matched_song_id (nullable),
  match_candidates (json, nullable), error_reason (nullable),
  timestamps per step
```

No Redis. The in-process worker reads/writes these rows; the UI polls or subscribes for live status.

## 8. Tech stack

- **Framework:** Next.js + TypeScript (API routes + React), single process. Familiar, light enough for the homelab PC, and gives a clean Tauri path later.
- **DB:** SQLite (one file) for import-job history.
- **Queue:** none — in-process sequential worker with a delay between deemix calls. **No BullMQ, no Redis.**
- **Frontend:** React with **shadcn/ui** (copy-in Tailwind components — owned in-repo, accessible by default, composes with TanStack Table). Uses shadcn's current default primitive layer, **Base UI** (as of the July 2026 shadcn changelog; `npx shadcn init` defaults here, `-b radix` opts back to Radix if ever needed). Dark Spotify/Feishin-style shell (sidebar + main table + no player bar). Plain fetch clients for Subsonic / Native / deemix APIs. TanStack Table for the sortable/filterable/bulk-select song table.
- **Deployment:** one new service in the existing docker-compose file, same network as navidrome/deemix. `./music` mounted rw; `./trash` mounted rw.
- **Optional later:** Tauri wrapper for a native macOS window.

## 9. Open questions / risks

- **deemix downloaded-file naming.** Confirm exactly how the `bambanah` build names/places a finished *single* track on disk (folder template `%artist% - %album%`, trackname `%artist% - %title%`) so the Subsonic `search3` match step (§6.1 step 5) is reliable. *(Next investigation item.)*
- **Deezer quality ceiling.** The current ARL is a **Free** Deezer account → **hard-capped at 128 kbps MP3**. 320 kbps needs a Premium ARL; FLAC needs a HiFi entitlement. Not a settings bug. Turn **bitrate/search/ISRC fallbacks ON** in deemix so tracks succeed instead of failing.
- **Deezer reliability.** deemix breaks periodically from Deezer-side changes. Pipeline must fail loudly/cheaply (use `connect`'s `deezerAvailable`), never hang.
- **Native API instability.** Undocumented, can change across Navidrome versions. Pin the image; isolate the client; expect this to be the thing that needs fixing after upgrades.
- **Match confidence.** deemix filenames/tags vs Navidrome's index may not line up (remixes, features, title formatting) → the `needs_review` path is required, not optional.
- **Delete safety, deferred layers.** v1 is move-to-`./trash` only. Consider later: scheduled auto-purge after N days, and/or an in-app "Recently deleted / Restore" view.
- **Replay Gain (organization win).** Turn ON deemix's Replay Gain tag — a shuffle-heavy singles library benefits from consistent loudness. Not app work, but a library-quality lever.
- **beets (parked).** Freshly added, unconfigured. Optional future "dedupe & normalize the existing mess" pass — a canonical inbox→import workflow. Out of scope until deliberately set up.
- **Feishin playback bug (separate).** Feishin's `SERVER_URL=http://navidrome:4533` is a docker-internal hostname; the browser can't resolve it for streaming, causing intermittent "can't play." Fix by pointing Feishin at a host-reachable URL or routing through the reverse proxy. Independent of this app.

## 10. Phased build plan

**Phase 1 — Library Browser (default screen).** Native API + Subsonic. Flat sortable/filterable song table, multi-select, bulk favorite/add-to-playlist. No deemix dependency → stable, immediately useful, proves out the track-first shell.

**Phase 2 — Import pipeline.** Paste/drop txt/csv → deemix search → queue single tracks → scan → match → add to playlist, with the live status table. deemix API is known, so risk here is mostly matching + Deezer flakiness, not discovery.

**Phase 3 — Cleanup / Delete + Music Folder Browser.** Move-to-`./trash` + purge-rescan, built on Phase 1's selection UI. Smart-playlist-backed stale-finder view. Direct `./music` file browser (§6.6) with the same move-to-trash delete.

**Phase 4 — System Overview + Polish.** The health dashboard (§6.5). Playlist detail/reordering, Tauri wrapper if wanted, optional trash auto-purge/restore, optional beets normalize pass.

**Later / additive — Webhook ingest (§6.7).** The `POST /api/webhook/import` endpoint + Shazam→iOS Shortcut flow. Builds directly on the Phase 2 pipeline; can slot in any time after Phase 2.
