# Maestro

A self-hosted, **track-first** companion app for a [Navidrome](https://www.navidrome.org/)
library. It's a **manager, not a player** — it organises a single-track library, imports new
tracks by name through a pluggable download backend, and cleans out dead weight. Playback stays
in Feishin / the Navidrome web UI.

In one line: a thin layer over **Navidrome** for better browsing, sorting, and bulk actions,
plus direct file deletion that Navidrome refuses to do — and a name-based import pipeline.

## Features

- **Import** — paste or drop a `.txt` / `.csv` list (`Artist - Title` per line). Each track is
  fetched through the configured download backend, scanned into Navidrome, matched, and added to
  a chosen playlist. Live per-row status, persisted history, and a manual "needs review" picker
  for ambiguous matches.
- **All Songs** — the whole library as one flat, server-sorted/filtered table with infinite
  scroll (no album pages). Bulk favourite, add-to-playlist, and delete. Shift-click range select,
  configurable page size, show/hide columns (persisted).
- **Playlists** — create, open (scoped in All Songs), delete; add/remove tracks; live in the
  sidebar.
- **Discovery** *(mockup)* — recommendations tuned to your library: suggested tracks, similar
  artists, and ready-made mixes, with one-click queue / send-to-pipeline actions. Currently sample
  data — the intended feed is [Last.fm](https://www.last.fm/api) / [MusicBrainz](https://musicbrainz.org/)
  seeded from your top artists, wired into the import pipeline.
- **Cleanup** — two modes. *Never played*: tracks you didn't just add (the dead weight), with an
  age cutoff (default 30 days, tunable) that keeps fresh imports off the list. *Duplicates*:
  groups copies of the same track (normalised artist+title, conservative/aggressive matching),
  suggests a keeper, and trashes the rest.
- **Delete → trash** — files move to `./trash` (recoverable), then Navidrome is purge-rescanned.
  Never a hard delete.
- **System** — health of Navidrome and the download backend, storage paths, and trash size with
  a one-click empty-trash (permanent).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · pnpm. No database
server and no job queue — an in-process worker handles imports, and import history is mirrored to
a JSON file. All configuration is read from environment variables.

## Configuration

All values come from env (see [`.env.example`](./.env.example)); nothing is hard-coded.

| Variable | Purpose | Default |
|---|---|---|
| `NAVIDROME_URL` | Navidrome base URL (internal service name in Docker) | `http://navidrome:4533` |
| `NAVIDROME_USERNAME` / `NAVIDROME_PASSWORD` | Navidrome credentials | — |
| `DEEMIX_URL` | Download backend base URL | `http://deemix:6595` |
| `DEEMIX_ARL` | Download backend auth token (needed for imports) | — |
| `MUSIC_DIR` / `TRASH_DIR` | Container paths for the music + trash volumes | `/music` / `/trash` |
| `DATABASE_PATH` | App data dir (import history lives alongside) | `/data/maestro.db` |
| `CACHE_TTL_SECONDS` | How long Navidrome reads are cached (busted on any change) | `86400` |
| `DEFAULT_PAGE_SIZE` | Initial fetch / default rows per page (user can override in UI) | `25` |
| `CLEANUP_MIN_AGE_DAYS` | Cleanup hides never-played tracks added more recently than this (excludes fresh imports; override per-visit in UI, `0` = off) | `30` |
| `IMPORT_DELAY_MS` / `IMPORT_TIMEOUT_MS` | Import pipeline pacing | `1500` / `300000` |
| `WEBHOOK_SECRET` / `WEBHOOK_PLAYLIST` | Reserved for the future webhook ingest | — / `Shazam` |
| `PORT` | Server port | `4544` |

## Running (deploy)

The bundled `docker-compose.yml` defines just the Maestro service — point it at your own
Navidrome instance and download backend via `.env`. It mounts `./music` and `./trash`
read-write so it can move files, and runs as the host `PUID:PGID`.

```bash
# set NAVIDROME_URL / NAVIDROME_USERNAME / NAVIDROME_PASSWORD, DEEMIX_URL, etc. in .env
docker compose up -d   # builds locally, or pulls the published image
```

Replace `OWNER` in `docker-compose.yml`'s `image: ghcr.io/OWNER/maestro` with your GitHub
username/org to pull the released image.

## Releasing to GHCR

Pushing a semver tag triggers the `release` GitHub Action, which builds a `linux/amd64` image
and pushes it to `ghcr.io/<owner>/maestro`:

```bash
pnpm release:patch   # bumps version, creates + pushes the tag
# -> publishes ghcr.io/<owner>/maestro:<version>, :<major>.<minor>, :latest, :sha-<short>
```

`release:minor` / `release:major` bump accordingly. CI (`ci.yml`) runs typecheck, lint, tests,
and build on every push/PR.

Then on the VM:

```bash
docker compose pull maestro && docker compose up -d maestro
```

## Development

```bash
pnpm install
pnpm dev            # http://localhost:4544 (point NAVIDROME_URL at a reachable instance)
pnpm test           # vitest
pnpm typecheck
pnpm lint
```

Create a `.env.local` with `NAVIDROME_URL` / `NAVIDROME_USERNAME` / `NAVIDROME_PASSWORD` (and
`DEEMIX_URL` / `DEEMIX_ARL` to exercise imports) pointing at a reachable instance. Without them
the app serves a sample library so the UI is still explorable.

## Notes

- **Import quality depends on your download backend** and its account tier.
- **Import keeps running if you close the browser** (server-side worker). A server restart
  mid-import doesn't resume, but finished history is persisted.
- The Navidrome **Native API** (`/api/*`) is used only for the sortable song list and is
  isolated in `src/lib/native.ts`; pin the Navidrome image version in production.

## License

[AGPL-3.0-only](./LICENSE). Network use counts as distribution: if you run a modified version as
a service, you must offer users the corresponding source.
