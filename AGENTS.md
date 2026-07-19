<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Maestro — project context for agents

**What it is:** a self-hosted, track-first manager layered over Navidrome (+ a deemix-compatible
download backend). It's a _manager, not a player_, and deliberately never renders album pages. See
[`README.md`](./README.md) for the product overview and roadmap.

## Commands

```bash
pnpm dev            # dev server (localhost:4544)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint (flat config)
pnpm format         # prettier --write .   (format:check to verify)
pnpm test           # vitest run
pnpm build          # next build (standalone output)
pnpm icons          # regenerate PWA PNGs from the SVG mark
```

A pre-commit hook runs lint-staged (eslint --fix + prettier) **and gitleaks** (strict — install it:
`brew install gitleaks`). Pre-push runs typecheck + tests.

## Layout

```
src/
  app/
    (app)/            authed shell (sidebar + auth gate); pages: page, playlists,
                      discovery, cleanup, import, settings/{account,library,system}
    login/            public login page
    api/              route handlers (all mutating + read routes gate with requireSession)
    icon.svg          favicon;  manifest.ts → PWA manifest;  apple-icon.png
    layout.tsx        root shell (ThemeProvider, metadata, viewport)
  proxy.ts            Next 16 middleware — optimistic cookie gate (real gate is the (app) layout)
  instrumentation.ts  boot: run auth migrations + seed admin (nodejs runtime only)
  lib/
    navidrome/        subsonic (stable /rest/*), native (/api/*), library (data facade), dedupe (pure)
    deemix/           download backend client (index.ts)
    import/           store, worker, parse  (+ __tests__)
    auth/             index (better-auth), auth-client, seed-admin, db-migrate
    storage/          trash, cache, paths (pure)  (+ __tests__)
    env.ts format.ts types.ts utils.ts version.ts sample-*.ts   (root: shared/pure)
  components/         UI (Base UI / shadcn under components/ui)
```

## Conventions & non-obvious rules

- **Server-only isolation.** Most `lib` modules start with `import "server-only"`. **Pure logic that
  needs unit tests must NOT import `server-only`/`env`** — extract it to a pure module (see
  `navidrome/dedupe.ts`, `storage/paths.ts`) and import that from the server module. Tests live in
  `__tests__/` folders (vitest matches `src/**/*.test.ts`).
- **Two Navidrome APIs.** Subsonic (`/rest/*`) is stable — prefer it. The Native API (`/api/*`) is
  unstable across Navidrome versions and confined to `lib/navidrome/`; a break there should be a
  one-file fix. **Pin the Navidrome image.**
- **⚠️ The Subsonic `path` is tag-derived** (`AlbumArtist/Album/Track`) and does NOT match the file on
  disk. For any filesystem op, resolve the **real** path from the Native API by song id
  (`getSongPaths`). Deletes go by **id**, never by a client-supplied path.
- **Delete = move to `./trash`**, then Navidrome purge-rescan. Never a hard delete. Path traversal is
  guarded by `safeRelPath` (unit-tested). **Every destructive action must have a confirmation step.**
- **Caching:** in-memory TTL cache (`storage/cache.ts`), `cached()` + `bust("songs","playlists")` on
  every mutation. Not Next's data cache (Next 16 changed `revalidateTag`).
- **Auth:** three layers — `proxy.ts` (optimistic cookie), `(app)/layout.tsx` (real DB session check),
  and `requireSession` in each route handler. New API routes MUST call `requireSession`.
- **No BullMQ/Redis/SQLite-for-data** — in-process import worker; import history is a JSON file; only
  auth uses SQLite (`node:sqlite`, hence Node 24).
- **Style:** pnpm (48h supply-chain cooldown), no emojis in code/commits, Prettier (printWidth 100).
  Server components first; push `"use client"` to leaves.

## DRY / KISS — reuse the shared helpers, keep units small

Before writing a fetch, a route guard, or a small utility, check for an existing helper —
most boilerplate is already extracted. Don't re-roll these:

- **API routes** (`lib/route.ts`): wrap **every** handler in `withSession(handler)` (session
  gate + error→500). Use `jsonError(msg, status)`, `readJson<T>(req)`, `requireNavidrome()`.
  Never re-copy the `requireSession` two-liner or a hand-rolled `{error}` JSON response.
- **Server API clients** (ListenBrainz / Deezer / Last.fm / new ones): use `getJson`/`postJson`
  from `lib/http.ts` (owns `no-store` + `accept: json` + `!res.ok → throw`); `trimSlash` for
  base URLs. (Subsonic/native/deemix keep bespoke request logic — leave them.)
- **Client fetches**: use `apiJson<T>(url, init?)` from `hooks/use-api.ts` (throws with the
  server's `{error}`); pair with `errMsg(e)` from `lib/utils.ts` in the `toast.error` catch.
- **Shared pure utils**: `errMsg` (utils), `mapLimit` (concurrency), `trackKey` (dedupe — the
  one true `artist␟title` key; never rebuild it inline), `coverGradient` (deterministic gradient).
- **Hooks** (`src/hooks/`): `usePersistent`, `useViewportWidth`, `useToggleSet`,
  `useInfiniteSongs`. New reusable stateful logic goes here, not inline in a component.

**Keep components small.** If a component passes ~300 lines or owns several unrelated concerns,
split it: sub-components to their own files, stateful logic into a `src/hooks/` hook, pure helpers
into `src/lib/`. `complexity`/`cognitive-complexity` eslint warnings mark the current oversized
files (songs-table, import-view, discovery-view, player-provider, library.ts) — treat them as
split targets, not as rules to silence.

## Do not commit

Stack runtime data (`/music`, `/trash`, `/navidrome`, `/deemix`, `/config`, `maestro-data`), `.env*`,
and `docs/PRD.md` are gitignored — keep it that way. Tests against a live library must be
non-destructive.
