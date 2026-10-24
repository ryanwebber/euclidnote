# Euclidnote Roadmap

A mobile-first, cell-based note app (PWA). A note is **one grid of cells**. Cells can be gathered into **groups**: a shared look you can duplicate and resize as one. The note scrolls down or right; the other axis is divided to fit the screen. It is for glanceable, hand-built notes, not dense tables.

## Target use cases (drive every milestone)

1. **Weightlifting tracker** – exercise name, reps as counters, rest timers inline.
2. **Golf yardage chart** – club / carry / total.
3. **Grocery list** – checkable rows, fast to add more.
4. **Gift ideas by person** – a repeated group per person.
5. **Vacation schedule by day** – a repeated group per day.

## Principles

- **Mobile first, fits the screen.** Content is sized to the viewport: no zooming, and no scrolling in a direction the note did not choose (see Flow & growth). The cross axis always fits. Cells are big and roughly square. The axis that does not scroll defaults to 2 cells and shrinks content to fit up to a hard cap of 5 (`MAX_FIT`); the scrolling axis is unbounded.
- **Feels like an app.** Full-height layout, safe-area insets, 44pt-ish touch targets, installable, works offline, no pinch-zoom workflows.
- **View mode is safe; editing is a mode.** The default is read-only: nothing can be moved or retyped by accident. Using widgets (tick a counter, start a timer) works in view mode. Structure, text and style change only in Edit mode.
- **Adding content is trivial.** "Add row" copies the shape of an existing row (widgets, styling, spans) with the content cleared. "Add column" does the same for every row, in either flow. Repeating a styled group is one action.
- **No themes, no whole-note templates.** We choose the look. Users get a small set of customizations and drop in **prefabs** (blocks, widgets) to build up a blank note.
- **A text format for us, not for users.** Notes and widgets serialize to a hand-editable text format ([docs/format.md](docs/format.md)). The app has no editor for it; we use it to author examples and prefabs, seed tests, and for eventual export/sharing. The editor UI is the only way users change a note.
- **Testable from the start.** All behaviour is pure functions in `src/model` (time injected), with thin React views and `data-testid` on every interactive element. Unit tests for the model, Playwright for flows at mobile and desktop viewports.
- **Sync is the platform's job.** No accounts, servers, or sharing. Any cross-device sync comes from being an installed PWA (e.g. platform storage/backup), not from us.

## Customization (the whole list; nothing more by default)

- Text: bold, italic, alignment (left / center / right).
- Layout: column widths (fr weights), cell spans, and flow (scroll down or right).
- Group presentation prefabs: `plain`, `grid`, `cards` (more later, e.g. `list`, `banner`).
- Dark / light mode following the system, and a manual override.

## The grid, groups, and flow (current guess, to iterate)

**The whole note is one grid.** Cells are placed on it by position and never overlap. Two kinds of thing live on it:

- **Loose cells**: a heading, a lone widget, anything that isn't part of a pattern.
- **Groups**: a rectangle of cells with a shared look (`plain`, `grid`, `cards`) that can be duplicated, resized and restyled as one. Groups don't have to be contiguous or fill a row or column: a few rows of a group, then a full-width heading, then more of the same group pattern is normal.

**Editing a group (Edit mode).** Select a group (tap its ▦ tab, or a cell then "Select group"). It shows handles:

- **An edge dot (top, bottom, left, right)**: drag out and release to *duplicate* the group wherever it lands, in that direction, content cleared. The ghost preview turns red when the drop can't work (it overlaps something or doesn't fit).
- **The corner dot**: drag to *resize*. Growing repeats the last row or column's shape with the content cleared; shrinking drops cells from the end.
- Buttons do the same without dragging: Rows ±, Cols ±, Copy below, Copy right.
- **Make group** turns a lone formatted cell into a one-cell group, which can then be dragged out into a list or table. Ungroup reverses it.
- Tap any empty slot to add a cell.

**Flow only changes how the note scrolls.** Cell positions are identical in both:

| | `down` (default) | `right` |
| --- | --- | --- |
| Scrolls | vertically, smoothly | horizontally, smoothly |
| Divided to fit the screen (max 5) | columns share the width | rows share the height |
| Unbounded | rows | columns |
| A column's width | its share of the screen width | a row's height × its weight |

- No paging or snapping on the scroll axis: smooth, free scrolling.
- The axis that doesn't scroll always divides exactly, so a whole number of cells (default 2, up to 5) fits and is aligned, with content scaling to fit.
- Switching flow never moves a cell. It is refused only when the content is too big for the new fitted axis; the button is disabled with an explanation.
- Flow is note-wide.

Done since: dragging groups and cells; auto-scroll while dragging; **insert-and-push** (a duplicate, a taller group, a new row or a fill pushes what is in the way along the scroll axis, and still refuses what would break the column or row cap); **reordering rows** inside a group (drag the grip of a selected cell, Alt + up/down, or long-press the selected cell); **long-press to lift** the selected cell (a loose cell moves, a grouped cell takes its row).

Not built yet, revisited once the above feels right:

- **Marquee**: drag across existing loose cells to group them.
- **Cell spans over rows**, and row heights other than one cell.
- **Two-way scrolling**: both axes unbounded, probably with sticky headers.

## M0 – The note view ✅ (see docs/note-view-plan.md; rounds 2 and 3 added widgets, looks, the ruler, sheets, a color-forward theme and the large-screen inspector)

- Vite + React + TypeScript + Zustand; note persisted to `localStorage` as its text format.
- Model: one grid; `Note` has a column template, loose `cells` and `groups` (rectangles of cell rows), placed by position and never overlapping. Thirteen widgets, nine group looks, thirteen fill colors, rich text styling. `flow` is `down` or `right` and changes only the scroll behavior.
- Text format parser/serializer (YAML) with path-naming errors, plus `examples/` notes validated by a unit test. Used for storage and authoring, not exposed in the UI.
- Pure ops (rejected edits return the same note): add cell, duplicate / resize / ungroup / delete group, make group, set type and style, switch flow. Pure geometry for hit-testing and drag targets.
- View/Edit mode, cell and group selection, group handles (drag edge dots to duplicate, corner to resize), empty-slot tap-to-add, bottom edit bar, `down` and `right` flow, three group looks, light/dark via `prefers-color-scheme`.
- Square-ish cells and content scaling by column count, with a 5-column cap.
- Vitest unit tests (format, ops, geometry, widgets, examples) and Playwright specs (mobile + desktop), including the drag gestures.
- **Status:** typecheck, 198 unit tests, the production build and 471 browser tests (phone, narrow desktop, and wide/inspector) pass. Verified in a headless browser only; real-device behaviour (touch ergonomics, software keyboard, haptics) is the next thing to check.

## M1 – Make it a real app

- ✅ Installable: web app manifest, icons (any, maskable, home screen, favicon; `npm run icons` redraws them from `scripts/icons.mjs`), theme colors for both schemes, and an offline-first service worker (`public/sw.js`: built files are cached on first use, pages go network-first and fall back to the cache). An Install button shows on the list page where the browser offers one. Still to verify on a real phone: the install flow, offline launch, and the icon under the system mask.
- ✅ Multiple notes: a list page on phones and tablets (cards with a thumbnail, newest edit first), a sidebar beside the note at 1100px and up. New (always blank), duplicate, delete (two taps), open; the route is `#/` (list) or `#/<id>`. Notes are stored one per key as text, with a small index; the single-note storage of older versions is adopted on first launch. Renaming is the note's own title in Edit mode.
- ✅ Storage: notes live in IndexedDB (`src/storage.ts`), read from memory so the app stays synchronous, with a localStorage fallback and a safety note in localStorage for any write the database has not finished (replayed on the next launch). Notes saved by older versions are moved across on first launch. The text format carries `version: 1`, with a migration pipeline (`src/model/versions.ts`) ready for the next change; a note from a newer version is refused, left untouched, and shown with a warning.

- ✅ Settings sheet (gear on the list page and in the sidebar): appearance (auto, light, dark, which also sets the browser-bar color), haptics, storage use and "protect from clearing", export and import of every note as one backup file, install, offline status, reload to update, version, delete everything.
- Note view polish: spacing, type scale, edit-bar ergonomics (it takes layout space, so cells resize entering Edit mode in `right` notes), feel on a real phone.

## M2 – Fast, safe editing

- Undo / redo (history of whole-note snapshots; ops are already pure).
- Drag to reorder rows and blocks (edit mode only, with a clear drag handle).
- Duplicate / delete block and row from a context menu on the selection; duplicate the *whole styled group* (e.g. "another person").
- Column width control (drag divider or presets: equal, 1:2, 2:1). Delete / reorder columns. Merge/split via span.
- Per-cell widget settings: counter step/label/target, timer countdown and presets.
- Clear selection affordances; arrow/Tab navigation on desktop.

## M3 – Beyond one axis

- Decide from real use whether two-way scrolling and row spans are worth it.
- Move groups and cells by dragging; marquee-select to group; auto-scroll while dragging; insert-and-push; delete/reorder rows and columns inside a group.
- Examples in `examples/` for each layout, with Playwright checks that the cross axis never overflows.

## M4 – Widgets

- Checkbox (grocery lists), number (units, decimals), select/tag, date/time.
- Timer: countdown, interval/rest presets, alert on finish (sound/vibration/notification).
- Counter: target and progress fill, reset.
- Widget registry: a new widget is one type, one view, one format entry, one test.
- Widget palette in the edit bar (replace the plain cell-type select).

## M5 – Repetition & structure

- Repeat patterns: a group plus a header cell that duplicates together ("add another person"); drag-to-fill several copies at once.
- Collapsible groups.
- Per-column formatting that new rows inherit (e.g. number with `yd` suffix).
- More presentation prefabs (list, banner, stat tiles).
- Optional simple derived values (sum of a column) if the use cases demand them.

## M6 – Format & portability

- Format versioning and migrations.
- Export / import a note as a text file (and share-sheet on mobile) using the text format.
- Prefab library authored in the text format: ready-made groups (e.g. a styled two-column list, a counter row) users drop into a blank note. Example notes live in `examples/` for development only.

## Open questions

- **Small-text legibility:** content shrinks with column count, but iOS zooms inputs below 16px, so edit-mode text stays 16px. Is that acceptable, or do we lock the viewport scale in the installed PWA?
- **Square cells vs. long text:** when text overflows a cell, grow the row (current), clip, or auto-shrink?
- **Subgrid reliance:** blocks use CSS subgrid (Safari 16+, all evergreen browsers). Acceptable floor?
- **Position-based addressing:** the format has no cell ids, so reorder/undo operate on indices. Fine for now; revisit if drag-reorder gets awkward.
- **Cross-device state:** timers are stored as `since` epoch ms, so they survive reload, but their meaning across devices depends on the platform's sync. Define what we promise.
- **PWA sync reality:** what iOS/Android actually syncs for an installed PWA's IndexedDB (often nothing). Probably supply export/import (M6) as the backup path instead of building sync.
- **Is note-wide flow enough?** Guess: yes. Revisit if someone needs a sideways-scrolling area inside a scrolling note.
- **Groups by containment vs. by membership:** a group is a rectangle whose cells are exactly the cells inside it, and the format stores them as its rows. Cells can't be in two groups. Is a rectangle always the right shape (an L-shaped group?), and how should a loose cell dropped onto a group behave?
- **Rejecting vs. pushing:** a duplicate or resize that would overlap is currently refused (red ghost). Is that the right default, or should it push things aside?
- **Handles on a phone:** edge dots are 32px touch targets that sit on the group's border, next to the group tab and neighbouring cells. They may be hard to hit and may fight with scrolling; needs real-device testing.
