# Maestro

A self-hosted, **track-first** companion app for a [Navidrome](https://www.navidrome.org/) +
[deemix](https://github.com/bambanah/deemix) music setup. It's a **manager, not a player** — it
downloads music by name, organises a single-track library, and cleans out dead weight. Playback
stays in Feishin / the Navidrome web UI.

In one line: a thin layer over **deemix** (download many songs by name) and **Navidrome**
(better browsing, sorting, bulk actions), plus direct file deletion that Navidrome refuses to do.

## Features

- **Import** — paste or drop a `.txt` / `.csv` list (`Artist - Title` per line). Each track is
  searched on Deezer, downloaded via deemix, scanned into Navidrome, matched, and added to a
  chosen playlist. Live per-row status, persisted history, and a manual "needs review" picker for
  ambiguous matches.
- **All Songs** — the whole library as one flat, server-sorted/filtered table with infinite
  scroll (no album pages). Bulk favourite, add-to-playlist, and delete. Shift-click range select,
  configurable page size, show/hide columns (persisted).
- **Playlists** — create, open (scoped in All Songs), delete; add/remove tracks; live in the
  sidebar.
- **Cleanup** — only never-played tracks (the dead weight), for safe bulk deletion.
- **Delete → trash** — files move to `./trash` (recoverable), then Navidrome is purge-rescanned.
  Never a hard delete.
- **System** — health of Navidrome + deemix, storage paths.

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
| `DEEMIX_URL` | deemix webui base URL | `http://deemix:6595` |
| `DEEMIX_ARL` | Deezer ARL token (needed for downloads) | — |
| `MUSIC_DIR` / `TRASH_DIR` | Container paths for the music + trash volumes | `/music` / `/trash` |
| `DATABASE_PATH` | App data dir (import history lives alongside) | `/data/maestro.db` |
| `IMPORT_DELAY_MS` / `IMPORT_TIMEOUT_MS` | Import pipeline pacing | `1500` / `300000` |
| `WEBHOOK_SECRET` / `WEBHOOK_PLAYLIST` | Reserved for the future webhook ingest | — / `Shazam` |
| `PORT` | Server port | `4544` |

## Running (deploy)

Maestro is a service in the existing docker-compose stack (alongside navidrome, deemix, feishin,
etc.). It mounts `./music` and `./trash` read-write so it can move files, and runs as the host
`PUID:PGID`.

```bash
# from the stack root (set NAVIDROME_USERNAME/PASSWORD, DEEMIX_ARL, etc. in .env)
docker compose up -d navi-organiser   # builds locally, or pulls the published image
```

Replace `OWNER` in `docker-compose.yml`'s `image: ghcr.io/OWNER/maestro` with your GitHub
username/org to pull the released image.

## Releasing to GHCR

Pushing a semver tag triggers the `release` GitHub Action, which builds a multi-arch image
(`linux/amd64`, `linux/arm64`) and pushes it to `ghcr.io/<owner>/maestro`:

```bash
pnpm release:patch   # bumps version, creates + pushes the tag
# -> publishes ghcr.io/<owner>/maestro:<version>, :<major>.<minor>, :latest, :sha-<short>
```

`release:minor` / `release:major` bump accordingly. CI (`ci.yml`) runs typecheck, lint, tests,
and build on every push/PR.

Then on the VM:

```bash
docker compose pull navi-organiser && docker compose up -d navi-organiser
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

- **Free Deezer ARL is capped at 128 kbps MP3.** 320 kbps needs a Premium ARL; FLAC needs HiFi.
- **Import keeps running if you close the browser** (server-side worker). A server restart
  mid-import doesn't resume, but finished history is persisted.
- The Navidrome **Native API** (`/api/*`) is used only for the sortable song list and is
  isolated in `src/lib/native.ts`; pin the Navidrome image version in production.

See [`docs/PRD.md`](./docs/PRD.md) for the full product spec.
