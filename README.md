<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/wordmark-white.svg" />
    <img src="./public/wordmark.svg" alt="Maestro" height="52" />
  </picture>
</p>

<p align="center">
  A self-hosted, <strong>track-first</strong> companion for a
  <a href="https://www.navidrome.org/">Navidrome</a> library — a <strong>manager, not a player</strong>.
</p>

<p align="center">
  <a href="https://github.com/byurhannurula/maestro/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/byurhannurula/maestro?sort=semver" /></a>
  <a href="https://github.com/byurhannurula/maestro/pkgs/container/maestro"><img alt="GHCR image" src="https://img.shields.io/badge/ghcr.io-byurhannurula%2Fmaestro-2496ED?logo=docker&logoColor=white" /></a>
  <a href="https://github.com/byurhannurula/maestro/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/byurhannurula/maestro/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue" /></a>
</p>

---

## What it is

Navidrome is a great server but an awkward _organiser_ — every client is album-centric, and it
refuses to touch files. Maestro is a thin layer on top for the things a **single-track, many-artist**
library actually needs:

- **Browse flat** — the whole library as one sortable/filterable table, no album pages.
- **Import by name** — paste a list of `Artist - Title` lines; it downloads, scans, matches, and
  files each into a playlist.
- **Clean up** — find never-played dead weight and duplicate copies, then **delete for real**
  (Navidrome only ever mounts music read-only).

Playback stays where it's good — Feishin, the Navidrome web UI, or any Subsonic app.

## Features

- **All Songs** — one flat, server-sorted/filtered, virtualized table with infinite scroll. Bulk
  favourite / add-to-playlist / delete, shift-click range select, show/hide columns and page size
  (persisted).
- **Import** — paste or drop a `.txt` / `.csv` (`Artist - Title` per line). Each track is fetched
  via the download backend, scanned into Navidrome, matched, and added to a chosen playlist. Live
  per-row status, persisted history, and a manual "needs review" picker for ambiguous matches.
- **Playlists** — create, open (scoped in All Songs), delete; add/remove tracks; live in the sidebar.
- **Cleanup** — two modes. _Never played_: dead weight, with an age cutoff (default 30d, tunable) so
  fresh imports aren't flagged. _Duplicates_: groups copies of the same track (conservative /
  aggressive matching), suggests a keeper, trashes the rest.
- **Delete → trash** — files move to `./trash` (recoverable), then Navidrome is purge-rescanned.
  Every destructive action is confirmed. Never a hard delete.
- **Settings** — Account, Library (stats, Navidrome version, scanner, download backend), and System
  (app/runtime, config, storage + one-click empty-trash).
- **Auth** — sign in with **PocketID** (OIDC) or an env-seeded break-glass admin. Public sign-up off.
- **Keyboard shortcuts** — `g`-then-key navigation, `⌘/Ctrl+,` for Settings, `r` to reload the
  library, `?` for help.
- **Installable (PWA)** — add to a phone home screen; runs standalone.
- **Discovery** _(mockup)_ — recommendations UI on sample data; the intended feed is
  Last.fm / MusicBrainz (see roadmap).

## How it works

```
  paste / drop            ┌──────────────────┐   Subsonic API (/rest/*)   ── stable
  Artist - Title  ──────▶ │      Maestro      │ ─▶ Navidrome
                          │   Next.js 16 · TS │   Native API (/api/*)      ── sort + real paths
   phone / browser  ────▶ │   (this app)      │ ─▶ Navidrome
                          │                   │   REST search + queue      ── download backend (deemix)
                          └────────┬──────────┘ ─▶
                                   │
             SQLite (auth)  +  import history JSON   ·   ./music (rw)  +  ./trash (rw)
```

- **Subsonic API** (`/rest/*`) — the stable workhorse: search, star, playlist CRUD, scans.
- **Native API** (`/api/*`) — used only for the sortable flat list and to resolve **real file paths**
  (the Subsonic path is tag-derived and doesn't match disk). Isolated in `src/lib/navidrome/`.
- **Download backend** — a deemix-compatible REST API for name-based downloads.
- **No database server, no job queue** — an in-process worker runs imports; history is mirrored to a
  JSON file; a small SQLite file backs auth. Reads are cached in-memory (24h) and busted on any change.

## What it needs

- A reachable **Navidrome** instance (URL + credentials) sharing the same **music folder** you mount
  into Maestro (deletes move files within it).
- A **download backend** (deemix-compatible) — only for the Import feature.
- **Docker** (or Node 24 + pnpm to run from source).
- A session secret (`BETTER_AUTH_SECRET`) and at least one sign-in method (PocketID **or** a seeded
  admin).

## Quick start (Docker)

```bash
docker run -d --name maestro -p 4544:4544 \
  -e NAVIDROME_URL=http://navidrome:4533 \
  -e NAVIDROME_USERNAME=admin -e NAVIDROME_PASSWORD=changeme \
  -e BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e BETTER_AUTH_URL=http://localhost:4544 \
  -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=changeme \
  -e DEEMIX_URL=http://deemix:6595 \
  -v /srv/media/music:/music \
  -v /srv/media/trash:/trash \
  -v maestro-data:/data \
  --user "$(id -u):$(id -g)" \
  ghcr.io/byurhannurula/maestro:latest
```

Then open <http://localhost:4544> and sign in with the admin you seeded.

> The `/music` and `/trash` mounts must be **writable by the `--user` you run as** — Maestro deletes
> by moving files. `/data` holds the auth DB + import history; make its host dir writable too.

## Deploy with Docker Compose

The repo ships a single-service [`docker-compose.yml`](./docker-compose.yml). Point it at your own
Navidrome + download backend via `.env` (copy [`.env.example`](./.env.example)):

```yaml
services:
  maestro:
    image: ghcr.io/byurhannurula/maestro:latest
    container_name: maestro
    user: "${PUID}:${PGID}"
    ports:
      - "4544:4544"
    env_file: .env
    volumes:
      - ./music:/music # the SAME folder Navidrome indexes
      - ./trash:/trash
      - ./maestro-data:/data
    restart: unless-stopped
```

```bash
docker compose up -d
# update to a new release later:
docker compose pull maestro && docker compose up -d maestro
```

## Configuration

Everything is env-driven (see [`.env.example`](./.env.example)); nothing is hard-coded.

| Variable                                        | Purpose                                                                   | Default                 |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| `NAVIDROME_URL`                                 | Navidrome base URL (service name inside Docker)                           | `http://navidrome:4533` |
| `NAVIDROME_USERNAME` / `NAVIDROME_PASSWORD`     | Navidrome credentials                                                     | —                       |
| `DEEMIX_URL`                                    | Download backend base URL                                                 | `http://deemix:6595`    |
| `DEEMIX_ARL`                                    | Download backend auth token (imports)                                     | —                       |
| `MUSIC_DIR` / `TRASH_DIR`                       | Container paths for the music + trash volumes                             | `/music` / `/trash`     |
| `DATABASE_PATH`                                 | App data (auth SQLite + import history)                                   | `/data/maestro.db`      |
| **`BETTER_AUTH_SECRET`**                        | Session-signing secret — **required** (`openssl rand -hex 32`)            | —                       |
| `BETTER_AUTH_URL`                               | Public origin (OAuth callbacks + cookies)                                 | `http://localhost:4544` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seed break-glass admin on first boot (blank = skip)                       | — / — / `Admin`         |
| `POCKETID_ISSUER_URL`                           | PocketID base URL (OIDC discovery derived from it)                        | —                       |
| `POCKETID_CLIENT_ID` / `POCKETID_CLIENT_SECRET` | PocketID OAuth client                                                     | —                       |
| `CACHE_TTL_SECONDS`                             | How long Navidrome reads are cached (busted on any change)                | `86400`                 |
| `DEFAULT_PAGE_SIZE`                             | Initial fetch / default rows per page                                     | `25`                    |
| `CLEANUP_MIN_AGE_DAYS`                          | Cleanup hides never-played tracks newer than this (UI-tunable, `0` = off) | `30`                    |
| `IMPORT_DELAY_MS` / `IMPORT_TIMEOUT_MS`         | Import pipeline pacing                                                    | `1500` / `300000`       |
| `WEBHOOK_SECRET` / `WEBHOOK_PLAYLIST`           | Reserved for the future webhook ingest                                    | — / `Shazam`            |
| `PORT`                                          | Server port                                                               | `4544`                  |

### Authentication

Access is delegated to **PocketID** — register an OIDC client with the callback URL
`${BETTER_AUTH_URL}/api/auth/oauth2/callback/pocketid`, then allow your user/group on that client.
Any PocketID-permitted user auto-provisions on first login. The env-seeded **admin** is the
break-glass fallback for when PocketID is unavailable. Public sign-up is disabled.

## Roadmap

**Done**

- [x] Flat All Songs browser (server sort/filter/paginate, virtualized, bulk actions)
- [x] Import pipeline (download → scan → match → playlist, history, needs-review)
- [x] Playlists (create/open/delete, add/remove)
- [x] Cleanup — never-played + age cutoff
- [x] Duplicate detection (metadata match, keeper + trash)
- [x] Delete → trash (confirmed, path-guarded, purge-rescan)
- [x] Settings (health, library stats, scanner, storage/trash)
- [x] Auth — better-auth + PocketID + break-glass admin
- [x] Keyboard shortcuts + installable PWA

**Planned**

- [ ] Music Folder Browser — browse the real `./music` tree, delete straight from disk
- [ ] Duplicate detection — stronger layers (ISRC / MusicBrainz ID, byte-identical file hash)
- [ ] Webhook ingest — Shazam → iOS Shortcut → auto-download into a playlist
- [ ] Recommendations — wire Discovery to real Last.fm / MusicBrainz / ListenBrainz feeds
- [ ] Import polish — per-row retry, Deezer-URL lines, resume in-flight batches after restart
- [ ] Playlist drag-reorder
- [ ] Delete safety — scheduled auto-purge, in-app "Recently deleted / Restore"
- [ ] Auth — in-app allowlist / roles

## Development

```bash
pnpm install
pnpm dev            # http://localhost:4544 (point NAVIDROME_URL at a reachable instance)
pnpm test           # vitest
pnpm typecheck
pnpm lint
pnpm format         # prettier --write
pnpm icons          # regenerate PWA icons from the SVG mark
```

Create a `.env.local` with `NAVIDROME_URL` / `NAVIDROME_USERNAME` / `NAVIDROME_PASSWORD` (and
`DEEMIX_URL` / `DEEMIX_ARL` to exercise imports). Without them the app serves a sample library so the
UI is still explorable. Commits run Prettier + ESLint + [gitleaks](https://github.com/gitleaks/gitleaks)
via a pre-commit hook; pushes run typecheck + tests.

### Releasing to GHCR

Pushing a semver tag triggers the `release` workflow, which builds a `linux/amd64` image and pushes
it to `ghcr.io/<owner>/maestro`:

```bash
pnpm release:patch   # bumps version, tags, pushes -> publishes :<version>, :<major>.<minor>, :latest
```

## Notes & caveats

- **Import quality** depends on your download backend and its account tier.
- **Import keeps running if you close the browser** (server-side worker); a mid-import server restart
  doesn't resume, but finished history is persisted.
- The Navidrome **Native API** (`/api/*`) is unstable across versions — it's isolated in
  `src/lib/navidrome/`; **pin the Navidrome image** in production.
- Deleting a file doesn't remove it from Navidrome playlists until its scan purges the missing track
  (run `navidrome scan --full` to reconcile immediately).

## License

[AGPL-3.0-only](./LICENSE). Network use counts as distribution: if you run a modified version as a
service, you must offer users the corresponding source.
