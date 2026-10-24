# Euclidnote

A mobile-first, cell-based note-taking PWA. A note is one grid of cells; cells can be gathered into groups with a shared look. It is for glancing at (counters, timers, lists, little trackers), not dense tables. Read `README.md` for the tour, `ROADMAP.md` for what is built and what is next, `docs/note-view-plan.md` for design decisions (and the ones we reversed), and `docs/format.md` for the text format.

## Commands

```
npm run dev            # Vite dev server; the dev library is filled with the examples (see Seeding)
npm run typecheck      # tsc --noEmit (strict; unused locals and parameters are errors)
npm test               # unit tests (vitest), src/**/*.test.ts
npm run build          # typecheck, then a production build in dist/
npm run test:e2e       # builds, then the Playwright suite (phone, narrow desktop, and wide projects)
npm run screenshots    # redraws docs/screenshots from a production build (run `npm run build` first)
npm run icons          # redraws the app icons in public/ from scripts/icons.mjs
npm run seed | seed:reset | seed:clear   # manage the dev library (opens ?seed=... on the dev server)
```

The browser tests serve `dist/` in-process on a fake origin (`e2e/serve.ts`), so they need the production build and no dev server or network. Set `PW_CHROMIUM` to use a Chromium that is already installed instead of Playwright's download. Because they run against the production build, dev-only code (seeding) is not covered by them.

## How it is laid out

- `src/model/` is pure and UI-free: types, geometry and hit-testing, layout validation (`validate.ts`), the text format (`format.ts`, `versions.ts`), edits (`ops.ts`), undo history, widget logic, the library index and thumbnails (`library.ts`), settings and backups (`settings.ts`). Time and storage are passed in, never read.
- `src/storage.ts` is the key-value store: IndexedDB behind a synchronous in-memory mirror, a localStorage fallback, and a write journal in localStorage for saves the database has not finished. `src/library.ts` is the list of notes and the `#/<id>` route; `src/store.ts` is the open note (mode, selection, history, debounced saves).
- `src/components/` are the views. `Grid.tsx` holds the drag planners; `drag.ts` is the pointer controller. Every interactive element has a `data-testid`; cell ids are `cell-<x>-<y>`.
- `public/` is copied as is: manifest, icons, `sw.js` (the build fills in its file list and cache name; see `vite.config.ts`).
- `examples/*.yaml` are sample notes, parsed by a unit test, used by the `/demo` route, and loaded into the dev library.

## Rules of the road

- **Behavior is an op first.** Add the pure function in `src/model` with a unit test, then the gesture, then an e2e test. Rejected edits return the *same* note object (`===`), which is how callers tell.
- **Positions are the same in both flows.** `flow: down | right` changes only how the note scrolls. The axis that fits the screen is capped at 5 (`MAX_FIT`).
- **View mode is read-only** except for widgets. Using a widget (`interact`) is saved but is not an undo step; structure and text edits (`edit`) are.
- **The text format is for us** (examples, tests, backups), not a user feature; there is no in-app editor for it. Notes carry `version:`; changing the format means bumping `FORMAT_VERSION` and adding a migration in `versions.ts`.
- **Never write over a note this version cannot read.** Unreadable notes open blank with a warning and saving switched off.
- **Style:** flat colors (no gradients), solid colored cards, no hover effects (touch first), roomy spacing, soft shadows instead of borders on popups. Widgets lay out by `data-arrange` (center, start, row) from the cell's place and width; see the widget section of `src/styles.css`.
- **Seeding is development only.** `src/devseed.ts` is loaded by a dynamic import behind `import.meta.env.DEV`, so production builds do not contain it. Do not import it from anywhere else.
- **The app works under any base path** (`BASE_PATH` at build time, for a project site on GitHub Pages). Use relative paths in the manifest and service worker, and `import.meta.env.BASE_URL` in code. Routing is by hash, so no server rewrites are needed.
- **Personal project.** Nothing in the repo should refer to an employer or an internal system. The lockfile must point at `https://registry.npmjs.org/` (a project `.npmrc` pins the registry).

## Working here

- Put scratch files (plans, notes, screenshots while iterating) in `./working`; it is git-ignored.
- Look at the result, not just the tests: take screenshots of what you change, on a phone viewport and a wide one, in light and dark.
- Keep the docs honest: when behavior changes, update `README.md`, `ROADMAP.md` (status and test counts) and `docs/` in the same change.
