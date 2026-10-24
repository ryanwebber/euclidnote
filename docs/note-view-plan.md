| Floating bottom dock (edit mode only) | Translucent blur, rounded. Undo/redo plus tools that follow the selection. Edit/Done live in the header, not here. |
# Completing the note view: plan and inventory

Scope: everything about viewing and editing one note, except the widgets themselves (counter, timer and text are enough to exercise it). The goal is that using it feels smooth and a little magical, on a phone first.

## 1. Principles

1. **View mode is calm and safe.** Content first, almost no chrome, nothing can be moved by accident. Widgets are still usable.
2. **Edit mode is direct manipulation.** Select by tapping, move/duplicate/resize/fill/span by dragging handles. Buttons only for things with no natural gesture (formatting, delete, undo).
3. **The layout never jumps between modes.** Edit is a small, quiet button in the header (hard to hit by accident); in Edit mode the same spot becomes Done and the dock slides up over the content. The space the dock needs is reserved in both modes, so a `right` note's cells do not resize when you start editing.
4. **Thumb-first.** Primary controls live in a floating dock at the bottom, not the top corner. Every touch target is at least 44pt.
5. **One obvious way, with shortcuts for experts.** Every gesture has a discoverable handle; desktop gets keyboard shortcuts.
6. **Never lose work.** Undo/redo for every edit, persistence on every change, rejected drops explain themselves (red ghost) instead of silently failing.

## 2. Feature inventory

### 2.1 Shell
| Feature | Notes |
| --- | --- |
| Slim top bar with the note title | Tap the title in Edit mode to rename inline. Leaves a slot for Back (notes list, later). Safe-area aware. |
| Floating bottom dock | Translucent blur, rounded. Morphs by mode and selection. Always present, constant height. |
| Popovers above the dock | Text styles, fill, cell type, group look, add, layout. Dismiss on outside tap or Esc. |
| Keyboard-aware | Dock rides above the on-screen keyboard (VisualViewport); the edited cell scrolls into view. |
| Layout/flow setting | One place (Layout popover): scroll direction ↓ / →, with an explanation when a switch is blocked. |
| Desktop | Content is centered with a max width in `down` notes; pointer + keyboard work. |

### 2.2 View mode
- Smooth scrolling (vertical for `down`, horizontal for `right`), momentum, no rubber-band leaks to the page.
- `right` notes: edge fades hint at off-screen content; the cross axis is always fully visible and aligned.
- Widgets: counter (±), timer (start/pause/reset) with clear running state; press feedback; no text selection or callouts on controls.
- Empty note state ("Tap Edit to start") and an empty-state hint in Edit mode.
- Light and dark mode, `prefers-reduced-motion` respected.

### 2.3 Edit mode: selecting
- Tap a cell → selects it (ring + tint). Tap empty canvas → deselect.
- Tap a group's grip (top-left tab) → selects the group.
- Tap a selected text cell again → edit the text (keyboard). Return commits.
- Empty slots show faint "+" targets; tapping one adds a text cell and starts editing it.
- Arrow keys move the selection (desktop); Esc deselects; Delete removes.

### 2.4 Edit mode: manipulating (all gestures use pointer capture, `touch-action: none` on handles)
| Gesture | Effect |
| --- | --- |
| Drag the grip of a selected cell or group | **Move** (ghost shows the landing spot; red if it can't land) |
| Drag a group's edge dot | **Duplicate** in that direction, wherever released, content cleared |
| Drag a group's corner | **Resize**; growing repeats the last row/column |
| Drag a loose cell's corner (fill handle) | **Fill**: turns the cell into a group of the dragged size, each cell a blank copy |
| Drag a cell's right edge | **Span** across columns (a heading across the full width) |
| Drag a column separator on the ruler | **Column widths** |
| Drag near a screen edge | **Auto-scroll**, so far-away drops are reachable |
| Return in the last row of a group | **New row** like it, editing starts in it |
| Tab / Shift-Tab | Next / previous cell |
| Haptic tick on lift/drop/invalid (where supported) | |

### 2.5 Edit mode: formatting (dock)
- Text: bold, italic, alignment, size (small / normal / large / title).
- Fill: a small fixed palette (7 tints that work in light and dark) or none.
- Cell type: text / counter / timer.
- Group look: plain / grid / cards. Ungroup. Delete.
- Add: heading, text cell, counter, timer; prefab groups (list, table, cards) dropped into the first free spot, selected.
- Undo / Redo (with coalescing of typing), Cmd/Ctrl-Z and Shift-Cmd-Z.

### 2.6 Rules the layout enforces
- One grid, nothing overlaps, at most 5 cells along the axis that fits the screen. Rejected edits return the same note (UI shows red ghost / disabled control).
- Flow switch never moves a cell; it's blocked only when content cannot fit.

## 3. Visual design

- **Type**: the system font, tabular numerals for counters/timers. Sizes scale with cell size (existing rule); minimum 11px, edit text never below 16px (iOS zoom).
- **Palette** (iOS-like system colors): background grouped gray `#F2F2F7` / black; surface white / `#1C1C1E`; one accent (system blue `#007AFF` / `#0A84FF`); semantic danger red, success green. Fills are tints (`color-mix` at ~16% over the surface) so they stay legible in dark mode.
- **Shape**: cards radius 18, cells radius 12, dock radius 28 with blur. Shadows are soft and small.
- **Motion**: spring-like transitions (~220ms) for selection ring, handles appearing, dock morphing, popovers; copies scale in; counters pop on change. All off under reduced motion.
- **Icons**: a small hand-drawn inline SVG set (undo, redo, plus, trash, layout, look, ungroup, align, fill, type).

## 4. Architecture changes

- **Model** (pure, unit-tested): style `size` and `fill`; `setSpan`, `moveGroup`, `moveCell`, `fillCell`, column weight ops, prefab insertion, `cellBelow/next` navigation, `appendRowLike`; history (undo/redo with coalescing) in the store; interactions with widgets (counter taps, timers) are not part of history.
- **Interaction layer**: one drag controller (pointer capture, hit-testing via `geometry.ts`, auto-scroll, haptics) used by every handle; selection overlay layer separate from cells; dock + popover components.
- **Layout**: the grid reserves the dock height always; `right` notes fit the remaining height.

## 5. Testing and the polish loop

- **Unit**: every new op, hit-testing, history coalescing, format round-trips (incl. new styles).
- **E2E** (Playwright, mobile + desktop viewports, serves `dist/` in-process, no network): every gesture, every dock control, keyboard flows, undo/redo, persistence, overflow invariants, both flows, dark mode renders.
- **Visual loop**: scripted screenshots of a matrix of notes (workout, yardage chart, grocery list, gifts with headings, trip in `right` flow, empty) × (iPhone portrait, landscape, desktop) × (light, dark) × (view, edit, selected cell, selected group, popover open, mid-drag). Review, fix, repeat. Findings and reversed decisions go in section 6.

## 6. Decisions revisited during the polish pass

(Filled in as the work proceeds.)

### Status: what was built

**Round 1** (shell, selection, every gesture, undo, both flows, dark mode, `/demo`) and **round 2**, below.

Round 2 asked for more widgets, a more beautiful theme, widgets that use space well, more group looks, easier ways to build, prettier menus and column controls, richer text styling, a better editing background, columns, group duplication and an editable counter label. All built:

| Ask | What it became |
| --- | --- |
| More widgets | Checkbox, rating, progress (draggable), tag (cycling status chip), date (native picker, relative text), joining counter and timer. Counters take a goal; every captioned widget has an editable label (tap the selected cell again) |
| Prettier theme | Warm paper background with a soft accent wash, ink text, one indigo-to-violet accent, pastel tints with deeper ink, layered card shadows, SF Rounded numerals, glass dock and sheets, spring motion. Real dark theme |
| Widgets at any size | Each cell is a container: wide cells lay a counter or timer out sideways with the caption kept; narrow cells shrink controls so nothing spills; stars scale with the cell |
| More looks | `plain, card, list, table, banded, stack, tiles, outline`, all drawn from one surface behind the *whole* group (stack and tiles being the per-row and per-cell variants), plus a tint per group |
| Easier building | Press an empty slot and drag across to sweep out a group; the Look sheet opens straight away. Tap a slot for a single cell |
| Prettier menus | Add and Look are tile sheets with live miniatures; Style (fonts, borders, colors, icons), Fill and Widget sheets; a menu hanging off each column tab |
| Column sizing | A ruler of tabs (tap for Narrow / Normal / Wide, insert left or right, equal widths, delete) with drag handles between them and a + to add a column |
| Text theming | Underline, strike, serif/mono/rounded fonts, thin/thick/dashed borders, 20 icons, text color |
| Editing background | A subtle dot matrix, only while editing |
| Duplicate a group | A Duplicate tool (and Add row inside a group) alongside dragging the edge dots |
| Counter label | Editable in place, or in the Widget sheet, or removable |

### Decisions revisited in round 2

| Was | Became | Why |
| --- | --- | --- |
| "Cards" = one card per row | `card` is one card for the whole group; the per-row version is `stack` | You asked for cards to encompass the whole group. Old names still load |
| Counter always showed "Reps" | No default label; editable | A fixed word is wrong for most counters |
| Wide widgets hid their caption | Caption stays, controls move to the side | Found in the desktop screenshot |
| Tapping a column tab closed its own menu | The ruler is exempt from "tap the canvas to deselect" | Caught by the e2e suite |
| Tapping a checkbox's words toggled it in edit mode | Words are inert while editing | Caught by the e2e suite |
| List hairlines keyed off `:first-child` | Keyed off "first column" | They poked out of the card |
| Tab-label dots showed through the ruler | Opaque tabs | The dot matrix made them noisy |

### Still open

- Long-press-to-lift, marquee selection, insert-and-push, drag-reordering rows inside a group, row heights other than one cell.
- Real-device checks: touch ergonomics of handles and the ruler, the software keyboard (the dock rides above it via `visualViewport`), haptics.
- A phone shows only about two day-columns of a `right` note at a time; widening columns with the ruler helps, but the default may deserve rethinking.

## Round 3

Asked for: more fills, stepped column sizes, a simpler selection, a ghost that matches the real outline, a recentered column "+", a better-separated style popup, a little more density, more widgets, a gentler drag, an iPad/desktop layout, refined looks, a more interesting theme, and a fixed progress bar. Then, while it was in progress: flat colors, smaller column steps, a softer popup edge, no hover effects, colored cards, and the original spacing back.

| Ask | What it became |
| --- | --- |
| More fill colors | Thirteen solid colors (coral, orange, mustard, lime, sage, teal, sky, periwinkle, violet, pink, sand, gray, ink). Text on a fill turns dark or light to stay readable |
| Stepped columns | Widths snap to half a grid square (0.5x, 1x, 1.5x...) with a haptic tick on each step; the menu offers half to three squares |
| Simpler selection | One crisp ink outline and small white handles. No glow, tint or fill; unselected groups lose their dashed frames (only plain groups keep one); empty slots are a faint plus; ruler tabs are outlines |
| Ghost = real outline | The drag preview draws the same surfaces the real thing would: a stack of pink pills while duplicating a stack, one card for a sweep, a single cell for a cell |
| Column "+" | An SVG plus, centered in its circle and on the tabs' midline |
| Popup edge | A layered soft shadow and no border (plus a faint top highlight in dark mode) |
| More widgets | Switch, number (type into it, with a unit), mood (five faces, one cycling face when narrow), habit (seven days), countdown, and a ring shape for progress |
| Gentle drag | Auto-scroll waits 220 ms at an edge, then ramps with the square of closeness, capped at 520 px/s and independent of frame rate. Moving an item now puts its top-left corner under your finger |
| Large screens | At 900px and up: no dock, an Inspector beside the note (fill, style, widget settings, looks, add, layout, and the selection's actions), undo/redo in the header, content capped to comfortable cell sizes |
| Refined looks | Nine, with the near-duplicates merged: plain, card, table, **header**, **sidebar**, **stripe** (asymmetric), stack, tiles, outline |
| Theme | Flat bone page, charcoal chrome, solid colored cards with ink controls, DIN-style condensed display type for titles and numbers, a coral accent. Real dark mode |
| Progress bar | Fixed: the knob and fill are measured inside the track, so neither pokes out; dragging keeps a draft in the component and writes once on release, which removed the lag. Persistence is batched (150 ms, flushed on page hide) |
| No hover | Removed; slots, handles and the ruler respond to presses only |
| Colored cards | New groups and card-like widgets arrive with the next color in a rotation; the examples use solid colored cards throughout |
| Spacing | The roomier original: 8px gaps, 10x14 cell padding, taller text rows |

### Round 3 decisions revisited

| Was | Became | Why |
| --- | --- | --- |
| Whole-square column steps | Half-square steps | One square was too coarse (your note) |
| Soft gradient wash behind the page | A flat color | Your note |
| A ring around the style popup | A shadow | The ring looked heavy (your note) |
| Tight density | Original density | Your note |
| Moving was "how many cells did the pointer travel" | The item's corner follows the pointer | A grip straddling a border could start in either row, so the same drag could land in different places |
| Auto-scroll sped up with the frame rate | Time-based | A 120 Hz display scrolled twice as fast |
| Ruler above handles | Ruler below handles | On the first row the ruler tabs swallowed taps meant for the group's grip |
| Page-level persistence on every change | Batched | Dragging a slider wrote the note dozens of times per second |

### Still open

- Real-device checks (touch ergonomics, the software keyboard, haptics) are still the biggest unknown.
- The display font depends on what the device ships (DIN Condensed or Avenir Next Condensed on macOS and iOS, Bahnschrift on Windows, Arial Narrow elsewhere); bundling a font would make it identical everywhere.
- Long-press-to-lift, marquee selection, insert-and-push, drag-reordering rows inside a group.

## Round 4

Asks: the duplicate placeholder at the real result size; more widgets, options and icons; consistent radii; a better column-width ruler; visible "+" slots; readable Lisbon and Habits examples; even margins in looks (yardages).

Results:

- The ghost is as tall as the result (`Plan.tall`), with track sizes measured once at drag start so it cannot move the hit-test.
- Five new widgets (pips, time, link, badge, bars), widget options (countdown timer, rating symbol, square checks, number prefix), 56 icons.
- Radii unified (`--r-lg`, `--r-md`); the ruler is taller with larger chips and a width readout; empty slots have a dashed border.
- Lisbon is now per-day cards; Habits uses compact one-line rows via container queries; yardage numbers use table-sized type with edge padding.

Tests: 138 unit, 357 browser (3 skipped). Stale assertions updated (group-edge padding, bare-canvas tap point, tall sheet covering a cell).
