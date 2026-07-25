# Maestro — Work Plan

Prioritised backlog of what's left, newest-first thinking on top. Ordered by
value ÷ risk. Checkboxes are the actual units of work. See `README.md` for the
product overview and `docs/PRD.md` for the spec (PRD is local/gitignored).

Legend: **P0** do next · **P1** soon · **P2** when there's appetite · **P3** nice-to-have.
Effort: S (<½ day) · M (~1 day) · L (multi-day).

---

## P0 — Quality / correctness gaps (the shipped code that isn't covered)

The Discovery + player + refactor landed without tests on the new critical
paths. Close that before building more on top.

- [ ] **Extract + unit-test the new pure logic** (Tier 4 of the refactor). Pure
      functions currently trapped inside `server-only`/I-O modules — pull each to
      a pure module (no `server-only`/`env`) with `__tests__`, mirroring
      `dedupe.ts` / `paths.ts`:
  - [ ] `lib/listenbrainz/parse.ts` — `cleanKind`, `dateOf`, `mbidFrom`, the
        priority-sort + dedupe of recommendation playlists. **M**
  - [ ] `lib/import/match.ts` — `norm` + `pickMatch` scoring from
        `import/worker.ts` (the match heuristic decides what gets added). **M**
  - [ ] `lib/navidrome/query.ts` — `processInMemory` / `compareBy` /
        `applyStaleCutoff` from `library.ts` (filter/sort/pagination). **M**
  - [ ] Move `pruneGroups` from `duplicates-view.tsx` into `dedupe.ts` + test. **S**
- [ ] **Test the Discovery enrichment shape** — `trackKey` matching, Deezer
      `lookupTrack` result mapping, and the recommended/artist dedupe in
      `discovery.ts` (mock the clients). **M**
- [ ] **Deezer/Last.fm/ListenBrainz client tests** — parse fixtures for the
      one-vs-array quirk (`asArray`) and error→null vs throw contracts. **S**

## P1 — Finish the refactor (started, ~half done)

Everything here is no-behaviour-change dedupe; verify with lint/typecheck/build.

- [ ] **Tier 2 — adopt the shared helpers everywhere** (created but under-used):
  - [ ] `apiJson` in the ~15 remaining client fetch sites: `songs-table` (×5),
        `import-view`, `duplicates-view`, `playlists-manager`, `app-sidebar`,
        `scan-button`, `empty-trash-button`, `keyboard-shortcuts`. **M**
  - [ ] `useToggleSet` in `discovery-view` (queue), `import-view` (queue),
        `duplicates-view` (selection). **S**
  - [ ] New hooks + adopt: `useDebouncedValue` (songs-table search),
        `useReload` (sidebar + shortcuts + reload-button), `useCreatePlaylist`
        (sidebar + playlists-manager + songs-table), `useAdaptivePoll`
        (import poll). **M**
  - [ ] Utils: `libraryTrack`/`previewTrack` player-track factories (songs-table
        / discovery / import), `deleteToTrash()` helper (songs-table +
        duplicates), fold `import`'s `timeAgo` into `format.ts`. **S**
  - [ ] `getSongPaths` → use `mapLimit` (currently unbounded `Promise.all`). **S**
- [ ] **Tier 3 — split the oversized files** (these are the remaining
      `complexity` / `cognitive-complexity` eslint warnings; treat the warning
      list as the tracker). Each split is behaviour-preserving:
  - [ ] `songs-table.tsx` (~980) → `SongCover`, `columns.ts`, dialogs,
        `SongsToolbar`, `SongsBulkBar`, `useRowSelection`, `useSongMutations`. **L**
  - [ ] `player-provider.tsx` (~440) → `player-bar.tsx` (UI) vs provider
        (engine); `usePlaybackEngine`; `<RangeSlider>`. **M**
  - [ ] `import-view.tsx` (~790) → `useImportBatches()` + move sub-components to
        `components/import/*`. **M**
  - [ ] `discovery-view.tsx` (~655) → `useDiscoverySections()`, move
        `TrackRow`/`TrackList`, consider server-fetching the initial sections. **M**
  - [ ] `library.ts` (~350) → `library/{songs,insights,system}.ts`. **M**
- [ ] **Tier 5 — cosmetic**: `<PageShell>` wrapper, `loadSongsPage()` page util,
      split `types.ts` by domain, align the two `Song` mappers, decide a
      `runtime` declaration policy. **S–M**

## P2 — Feature gaps from the PRD

- [ ] **Music Folder Browser (§6.6)** — the last unchecked _core_ pillar. Direct
      `./music` tree view, "indexed by Navidrome?" flag, delete-from-disk via the
      same trash flow. Also unlocks the file-hash dedup layer. **L**
- [ ] **Duplicate detection — stronger layers (§13)** — ISRC/MBID match, then
      byte-identical file-hash (needs the folder browser). **M each**
- [ ] **Import polish** — Deezer-URL import lines actually resolve+download
      (currently parse as `kind:url` but the worker is title-based); resume an
      in-flight batch after a server restart; per-row retry that re-runs one job
      in place (vs a new batch). **M**
- [ ] **Playlist drag-reorder** — only meaningful in playlist-order sort;
      Subsonic `updatePlaylist` by index. **M**
- [ ] **Delete safety layers** — scheduled auto-purge after N days + an in-app
      "Recently deleted / Restore" view. **M**

_Dropped by decision:_ in-app auth allowlist/roles (single user; access delegated
to PocketID).

## P3 — Nice-to-have / polish

- [ ] **Logs page** (Explo-style) — tail app + import-worker output; the fourth
      Explo reference screen. **M**
- [ ] **Player everywhere / hover-preview** — extend the loved preview UX to more
      surfaces (already wired into songs-table covers; consider playlist views). **S**
- [ ] **Login backgrounds resize script** — `pnpm` step to downscale
      `public/login/*` (drop full-size photos, ship optimised). **S**
- [ ] **Full-scan-from-UI** — Subsonic `startScan` is quick-only; phantom-row
      purge still needs `navidrome scan --full` on the CLI. Surface or automate. **M**
- [ ] `/api/trash` GET handler-level `requireSession` (currently proxy-gated only). **S**
- [ ] **Tauri desktop wrapper**, **beets normalize pass** — parked. **L**

---

## Cross-cutting reminders

- After any change: `pnpm lint` (0 errors), `pnpm typecheck`, `pnpm test`,
  `pnpm build` — all green before commit. Pre-commit runs lint-staged + gitleaks;
  pre-push runs typecheck + tests.
- Reuse the shared helpers (see AGENTS.md "DRY / KISS"): `withSession`,
  `apiJson`, `getJson`/`postJson`, `errMsg`, `mapLimit`, `trackKey`,
  `coverGradient`, `usePersistent`, `useViewportWidth`.
- Cut a **release** (`pnpm release:minor`) once Discovery/player/webhook settle —
  last tag was `v0.5.0`.
