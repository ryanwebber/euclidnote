# Note format

This is an internal authoring and interchange format, not a user-facing feature: the app
has no text editor for it. We use it to write example notes (`examples/`, also the `/demo`
samples), build the future starter groups/prefabs, seed tests, and for eventual export/share.
It stays trivially hand-editable on purpose.

A note is **one grid**. Things are placed on it by position, `at: [column, row]`, both
counted from 0. There are two kinds of thing:

- **cells**: single cells sitting on their own (a heading, a lone widget).
- **groups**: a rectangle of cells that share a look and can be duplicated or resized as
  one. A group's `rows` are relative to its `at`.

Nothing may overlap. Groups need not be contiguous: you can have a few rows of a group,
a full-width heading, then another group with the same pattern.

```yaml
title: Leg day
columns: [2fr, 1fr, 1fr]        # column weights; defaults to even, and grows to fit the content
cells:
  - {at: [0, 0], span: 3, text: Leg day, bold: true, size: large, icon: dumbbell}
groups:
  - at: [0, 1]
    variant: card               # how the group is drawn, see Looks
    fill: blue                  # optional tint for the group's surface
    rows:
      - [{text: Squat, bold: true}, {counter: 0, label: Reps, goal: 10}, {timer: 0, label: Rest}]
      - [{text: Lunge, bold: true}, {counter: 0, label: Reps, goal: 10}, {timer: 0, label: Rest}]
```

Every row of a group covers the same number of columns (counting `span`s).

## Flow

`flow: down` (default) or `flow: right` only changes how the note scrolls. **Cell
positions are identical either way.** The axis that does not scroll is divided to fit the
screen, so it is capped at 5:

| `flow` | Scrolls | Fits the screen (max 5) | Unbounded |
| ------ | ------- | ----------------------- | --------- |
| `down`  | vertically   | columns share the width | rows |
| `right` | horizontally | rows share the height   | columns |

In a `down` note the column weights (`1fr`, `2fr`) split the screen width. In a `right`
note a column is as wide as a row is tall, times its weight, however many there are.
A note can switch flow only if its content fits: at most 5 columns to go `down`, at most
5 rows to go `right`.

## Looks (`variant`)

| Look | Drawn as |
| ---- | -------- |
| `plain` (default) | nothing |
| `card` | one card around the whole group |
| `table` | one card, hairlines between rows and columns |
| `header` | one card, the top row set off as a header band (asymmetric) |
| `sidebar` | one card, the first column set off as labels (asymmetric) |
| `stripe` | one card with a bar down its left edge (asymmetric) |
| `stack` | a separate card for each row |
| `tiles` | each cell its own tile |
| `outline` | an outline around the group |

A group can have `fill: <color>`, which colors its surface solidly (the text on it turns light or dark to stay readable).
`grid` and `cards` from early versions load as `table` and `stack`; `list` loads as `table` and `banded` as `header`.

## Cells

A cell is a bare value (text), or a mapping with one widget key.

| Written as | Meaning |
| --- | --- |
| `Squat`, `250`, `~` | Text (bare values; `~` is empty). Only inside a group's `rows` |
| `{text: Squat}` | Text, as a mapping (always used for loose cells) |
| `{check: true, text: Milk}` | Checkbox with words |
| `{toggle: true, text: Wi-Fi}` | Switch with words |
| `{counter: 3, step: 5, label: Reps, goal: 10}` | Counter. `step` default 1; `label` and `goal` optional |
| `{number: 72.4, unit: kg, label: Weight}` | A number you type into; `number: ~` is empty |
| `{timer: 90000, label: Rest}` | Stopwatch, elapsed ms. `since: <epoch ms>` = running |
| `{rating: 3, max: 5, label: Taste}` | Stars (`max` 1 to 10, default 5) |
| `{mood: 4, label: Today}` | A face from 1 (rough) to 5 (great); 0 is not set |
| `{progress: 40, shape: ring, label: Goal}` | Progress, 0 to 100, as a bar (default) or a ring |
| `{habit: [1, 1, 0, 1, 0, 0, 0], label: Run}` | Seven days, Monday first |
| `{tag: Doing, options: [To do, Doing, Done]}` | Status chip; tapping cycles `options` (default shown) |
| `{date: 2026-10-23, label: Due}` | A calendar date; `date: ""` means not set |
| `{countdown: 2026-12-25, label: Xmas}` | Days to (or since) a date |
| `{pips: 2, max: 4, label: Sets}` | Dots you tap to fill (`max` 2 to 12) |
| `{time: "07:30", label: Alarm}` | A time of day, HH:MM |
| `{link: example.com, text: Menu}` | A tappable link (http/https only; https is added) |
| `{badge: rocket, label: Launch}` | A big icon (any icon name) |
| `{bars: [2, 4, 3, 6, 5, 8, 3], max: 10, axis: week, label: Steps}` | 2 to 14 draggable bars. `axis: week` needs 7 values and labels them M to S; without it the chart is custom (any count, no labels) |

Options on existing widgets: timer `from: <ms>` (counts down and stops at zero), rating `symbol: <icon>`, check and habit `shape: square`, number `prefix: $`.

Any cell can also have:

| Key | Values |
| --- | --- |
| `span` | number of columns covered |
| `bold`, `italic`, `underline`, `strike` | `true` |
| `align` | `center`, `right` |
| `size` | `small`, `large`, `title` |
| `font` | `serif`, `mono`, `rounded`, `display` (condensed capitals); sans is the default |
| `border` | `thin`, `thick`, `dashed` |
| `layout` | widgets only: `center`, `start` (caption on top) or `row` (caption column, then the control). Unset picks automatically: center on tiles and loose cells, row in wide list rows |
| `icon` | any of 56 names: star, heart, flag, bolt, check, clock, calendar, pin, cart, gift, dumbbell, fire, drop, sun, moon, note, dollar, plane, bed, fork, rocket, wifi and more (see `ICON_NAMES` in `src/model/types.ts`) |
| `color` | text tint |
| `fill` | a solid background for the cell |

Colors (for `fill`, `color` and group `fill`): red, orange, yellow, lime, green, teal, blue, indigo, purple, pink, sand, gray, ink.

Column weights move in half squares in the editor (`0.5fr`, `1fr`, `1.5fr`...); hand-written values are kept as written until you drag them.

## Rules

- No ids: everything is addressed by position.
- Invalid text is rejected with a message naming the offending path, e.g.
  `groups[1].rows[1][2] must have exactly one of text, counter, ...`, or
  `cells[0] and groups[0] overlap`.

## Versions

A note starts with `version: 1`. Notes written before versions existed have none, and are read as version 1. When the format changes, the app bumps the number and upgrades older notes as they are read (see `src/model/versions.ts`). A note with a higher version than the app knows is refused rather than guessed at, and is never overwritten.
