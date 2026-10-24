// Pure edits on a Note. Every function returns a new Note and never mutates its
// input. Edits that could produce an invalid layout (overlap, too wide to fit) return
// the *same* note instead, so callers can tell a rejected edit with `===`.
import { type Rect, allRects, cellAt, cellWidth, extent, groupCells, groupRect, locate, looseRect, overlaps, padColumns, rowWidth, allCells } from './geometry'
import {
  type Cell,
  type CellRef,
  type CellStyle,
  type CellType,
  DEFAULT_FIT,
  DEFAULT_TAG_OPTIONS,
  type Fill,
  type Flow,
  type Group,
  type Note,
  type Variant,
} from './types'
import { layoutError } from './validate'

export function defaultCell(type: CellType): Cell {
  switch (type) {
    case 'text':
      return { type, text: '' }
    case 'check':
      return { type, checked: false, text: '' }
    case 'counter':
      return { type, value: 0, step: 1 }
    case 'timer':
      return { type, ms: 0, since: null }
    case 'rating':
      return { type, value: 0, max: 5 }
    case 'progress':
      return { type, value: 0 }
    case 'toggle':
      return { type, on: false, text: '' }
    case 'pips':
      return { type, value: 0, max: 5 }
    case 'time':
      return { type, value: '' }
    case 'link':
      return { type, url: '', text: '' }
    case 'badge':
      return { type, icon: 'star' }
    case 'bars':
      return { type, values: Array(7).fill(0), max: 10, axis: 'week' }
    case 'number':
      return { type, value: null }
    case 'mood':
      return { type, value: 0 }
    case 'habit':
      return { type, days: Array(7).fill(false) }
    case 'tag':
      return { type, value: DEFAULT_TAG_OPTIONS[0], options: DEFAULT_TAG_OPTIONS }
    case 'date':
    case 'countdown':
      return { type, value: '' }
  }
}

// Same widget and styling, content cleared. This is what makes duplicating a group,
// or growing one, produce a ready-to-fill copy.
export function blankLike(cell: Cell): Cell {
  switch (cell.type) {
    case 'text':
      return { ...cell, text: '' }
    case 'check':
      return { ...cell, checked: false, text: '' }
    case 'counter':
      return { ...cell, value: 0 }
    case 'timer':
      return { ...cell, ms: 0, since: null }
    case 'rating':
    case 'progress':
    case 'mood':
      return { ...cell, value: 0 }
    case 'toggle':
      return { ...cell, on: false, text: '' }
    case 'pips':
      return { ...cell, value: 0 }
    case 'time':
      return { ...cell, value: '' }
    case 'link':
      return { ...cell, url: '', text: '' }
    case 'badge':
      return cell
    case 'bars':
      return { ...cell, values: cell.values.map(() => 0) }
    case 'number':
      return { ...cell, value: null }
    case 'habit':
      return { ...cell, days: Array(7).fill(false) }
    case 'tag':
      return { ...cell, value: cell.options[0] ?? '' }
    case 'date':
    case 'countdown':
      return { ...cell, value: '' }
  }
}

// Commit `next` if its layout is valid (padding the column template to fit),
// otherwise keep `prev`.
function settle(prev: Note, next: Note): Note {
  const padded = padColumns(next)
  return layoutError(padded) ? prev : padded
}

// Making room. Growing something (a duplicate, a taller group, a new row) into other things pushes those
// along the way the note scrolls (down, or right) instead of refusing. They move just far enough, and
// whatever they then run into moves too. Anything the caller moved on purpose stays where it was put.
type Moved = { kind: 'cell' | 'group'; i: number }

function pushOut(note: Note, moved: Moved): Note {
  const axis = note.flow === 'down' ? 'y' : 'x'
  type Entry = { kind: Moved['kind']; i: number; r: Rect }
  const entries: Entry[] = [
    ...note.cells.map((p, i): Entry => ({ kind: 'cell', i, r: looseRect(p) })),
    ...note.groups.map((g, i): Entry => ({ kind: 'group', i, r: groupRect(g) })),
  ]
  const anchor = entries.find((e) => e.kind === moved.kind && e.i === moved.i)
  if (!anchor) return note
  const placed: Rect[] = [anchor.r]
  const to = new Map<Entry, Rect>()
  const others = entries.filter((e) => e !== anchor).sort((a, b) => a.r[axis] - b.r[axis] || a.r.x - b.r.x || a.r.y - b.r.y)
  for (const e of others) {
    let r = e.r
    for (let hit = placed.find((p) => overlaps(p, r)); hit; hit = placed.find((p) => overlaps(p, r))) {
      r = axis === 'y' ? { ...r, y: hit.y + hit.h } : { ...r, x: hit.x + hit.w }
    }
    if (r !== e.r) to.set(e, r)
    placed.push(r)
  }
  if (to.size === 0) return note
  const at = (kind: Moved['kind'], i: number) => [...to].find(([e]) => e.kind === kind && e.i === i)?.[1]
  return {
    ...note,
    cells: note.cells.map((p, i) => {
      const r = at('cell', i)
      return r ? { ...p, x: r.x, y: r.y } : p
    }),
    groups: note.groups.map((g, i) => {
      const r = at('group', i)
      return r ? { ...g, x: r.x, y: r.y } : g
    }),
  }
}

// Like settle, but things in the way of `moved` are pushed aside first.
const settlePushing = (prev: Note, next: Note, moved: Moved): Note => settle(prev, pushOut(next, moved))

// ---- cells ----

export function getCell(note: Note, ref: CellRef | null | undefined): Cell | undefined {
  if (!ref) return undefined
  return ref.in === 'loose' ? note.cells[ref.i]?.cell : note.groups[ref.g]?.rows[ref.r]?.[ref.c]
}

export function updateCell(note: Note, ref: CellRef, fn: (c: Cell) => Cell): Note {
  if (ref.in === 'loose') {
    return { ...note, cells: note.cells.map((p, i) => (i === ref.i ? { ...p, cell: fn(p.cell) } : p)) }
  }
  return {
    ...note,
    groups: note.groups.map((g, gi) =>
      gi !== ref.g
        ? g
        : { ...g, rows: g.rows.map((row, r) => (r !== ref.r ? row : row.map((c, ci) => (ci === ref.c ? fn(c) : c)))) },
    ),
  }
}

export function setCellText(note: Note, ref: CellRef, text: string): Note {
  return updateCell(note, ref, (c) => (c.type === 'text' ? { ...c, text } : c))
}

export function setCellType(note: Note, ref: CellRef, type: CellType): Note {
  return updateCell(note, ref, (c) => {
    if (c.type === type) return c
    const next: Cell = { ...defaultCell(type), style: c.style, span: c.span }
    // Text survives switching between the text-like cells.
    const hasText = (x: Cell): x is Cell & { text: string } => x.type === 'text' || x.type === 'check' || x.type === 'toggle' || x.type === 'link'
    const text = hasText(c) ? c.text : ''
    if (hasText(next) && text) next.text = text
    return next
  })
}

export function patchStyle(note: Note, ref: CellRef, patch: Partial<CellStyle>): Note {
  return updateCell(note, ref, (c) => {
    const next: CellStyle = { ...c.style, ...patch }
    // Defaults are not stored, so the document stays minimal.
    for (const k of ['bold', 'italic', 'underline', 'strike'] as const) if (!next[k]) delete next[k]
    if (!next.align || next.align === 'left') delete next.align
    for (const k of ['size', 'font', 'border', 'layout', 'icon', 'color', 'fill'] as const) if (!next[k]) delete next[k]
    return { ...c, style: Object.keys(next).length ? next : undefined }
  })
}

// ---- loose cells ----

// New cards and widgets arrive in color, taking the next one in turn so neighbours differ.
const PALETTE: Fill[] = ['yellow', 'indigo', 'red', 'green', 'blue', 'pink', 'orange', 'teal', 'lime', 'purple', 'sand']
const colored = (note: Note) =>
  note.groups.filter((g) => g.fill).length + note.cells.filter((p) => p.cell.style?.fill).length
export const nextFill = (note: Note): Fill => PALETTE[colored(note) % PALETTE.length]
// Widgets that read as a card of their own; text and checklists stay plain.
const CARDY: CellType[] = ['counter', 'timer', 'rating', 'mood', 'progress', 'pips', 'habit', 'bars', 'date', 'time', 'countdown', 'number', 'badge']

export function addCell(note: Note, x: number, y: number, type: CellType = 'text'): Note {
  return settle(note, { ...note, cells: [...note.cells, { x, y, cell: defaultCell(type) }] })
}

export function deleteLooseCell(note: Note, i: number): Note {
  return { ...note, cells: note.cells.filter((_, k) => k !== i) }
}

// Wraps a loose cell in a one-cell group, which can then be dragged out into a
// pattern. This is how a formatted cell becomes something repeatable.
export function groupCell(note: Note, i: number): Note {
  const placed = note.cells[i]
  if (!placed) return note
  const group: Group = { x: placed.x, y: placed.y, variant: 'plain', rows: [[placed.cell]] }
  return { ...note, cells: note.cells.filter((_, k) => k !== i), groups: [...note.groups, group] }
}

// ---- groups ----

// A prefab: a blank group dropped into the first free spot. Two cells along the axis
// that fits the screen: two columns wide in a `down` note, two rows tall in `right`.
export function insertGroup(note: Note, variant: Variant): Note {
  const w = note.flow === 'down' ? Math.min(DEFAULT_FIT, Math.max(1, note.columns.length)) : 1
  const h = note.flow === 'down' ? 1 : DEFAULT_FIT
  const spot = firstFree(note, w, h)
  if (!spot) return note
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => defaultCell('text')))
  return settle(note, { ...note, groups: [...note.groups, { ...spot, variant, fill: nextFill(note), rows }] })
}

// First position (reading order for `down`, column by column for `right`) where a
// w x h rectangle fits without overlapping anything.
export function firstFree(note: Note, w: number, h: number): { x: number; y: number } | null {
  const rects = allRects(note)
  const free = (x: number, y: number) => !rects.some((r) => overlaps(r, { x, y, w, h }))
  if (note.flow === 'down') {
    const cols = Math.max(1, note.columns.length)
    if (w > cols) return null
    for (let y = 0; ; y++) for (let x = 0; x + w <= cols; x++) if (free(x, y)) return { x, y }
  }
  const rows = Math.max(DEFAULT_FIT, extent(note).rows, h)
  for (let x = 0; ; x++) for (let y = 0; y + h <= rows; y++) if (free(x, y)) return { x, y }
}

// A copy of group `g` with its content cleared, placed with its top-left at (x, y).
export function duplicateGroup(note: Note, g: number, x: number, y: number): Note {
  const src = note.groups[g]
  if (!src) return note
  const copy: Group = { ...src, x, y, rows: src.rows.map((row) => row.map(blankLike)) }
  return settlePushing(note, { ...note, groups: [...note.groups, copy] }, { kind: 'group', i: note.groups.length })
}

// Grow or shrink a group to w x h cells. Growing repeats the last row / column's
// shape with the content cleared; shrinking drops cells from the end.
export function resizeGroup(note: Note, g: number, w: number, h: number): Note {
  const src = note.groups[g]
  if (!src || w < 1 || h < 1) return note
  let rows = src.rows.slice(0, h)
  while (rows.length < h) rows = [...rows, rows[rows.length - 1].map(blankLike)]
  rows = rows.map((row) => resizeRow(row, w))
  return settlePushing(note, { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, rows } : gr)) }, { kind: 'group', i: g })
}

function resizeRow(row: Cell[], w: number): Cell[] {
  const out: Cell[] = []
  let used = 0
  for (const c of row) {
    if (used >= w) break
    const span = Math.min(cellWidth(c), w - used)
    out.push(span === cellWidth(c) ? c : { ...c, span: span > 1 ? span : undefined })
    used += span
  }
  const last = row[row.length - 1]
  while (used < w) {
    out.push({ ...blankLike(last), span: undefined })
    used += 1
  }
  return out
}

export const setGroupVariant = (note: Note, g: number, variant: Variant): Note => ({
  ...note,
  groups: note.groups.map((gr, i) => (i === g ? { ...gr, variant } : gr)),
})

export function ungroup(note: Note, g: number): Note {
  const src = note.groups[g]
  if (!src) return note
  const cells = groupCells(src).map(({ x, y, cell }) => ({ x, y, cell }))
  return { ...note, groups: note.groups.filter((_, i) => i !== g), cells: [...note.cells, ...cells] }
}

export const deleteGroup = (note: Note, g: number): Note => ({
  ...note,
  groups: note.groups.filter((_, i) => i !== g),
})


// ---- note ----

// Cells never move when the flow changes, so the only thing that can stop a switch
// is content too big to fit the axis that would then have to fit the screen.
export const canSetFlow = (note: Note, flow: Flow) => !layoutError({ ...note, flow })

export function setFlow(note: Note, flow: Flow): Note {
  return note.flow === flow || !canSetFlow(note, flow) ? note : { ...note, flow }
}

export const setTitle = (note: Note, title: string): Note => ({ ...note, title })


// ---- move, span, fill ----

export function moveGroup(note: Note, g: number, x: number, y: number): Note {
  const src = note.groups[g]
  if (!src || (src.x === x && src.y === y)) return note
  return settle(note, { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, x, y } : gr)) })
}

export function moveLoose(note: Note, i: number, x: number, y: number): Note {
  const src = note.cells[i]
  if (!src || (src.x === x && src.y === y)) return note
  return settle(note, { ...note, cells: note.cells.map((p, k) => (k === i ? { ...p, x, y } : p)) })
}

// Make a cell cover `span` columns. A loose cell just grows (if there is room). In a
// group the row keeps its width: growing takes room from the cells after it, and
// shrinking gives the room back as blank cells.
export function setSpan(note: Note, ref: CellRef, span: number): Note {
  const cell = getCell(note, ref)
  if (!cell || span < 1 || span === cellWidth(cell)) return note
  const withSpan = (c: Cell): Cell => ({ ...c, span: span > 1 ? span : undefined })
  if (ref.in === 'loose') {
    return settle(note, { ...note, cells: note.cells.map((p, i) => (i === ref.i ? { ...p, cell: withSpan(p.cell) } : p)) })
  }
  const group = note.groups[ref.g]
  const row = group.rows[ref.r]
  const width = rowWidth(row)
  const before = row.slice(0, ref.c)
  const startsAt = rowWidth(before)
  if (startsAt + span > width) return note // would run past the group's right edge
  let after = row.slice(ref.c + 1)
  let need = startsAt + span - (startsAt + cellWidth(cell)) // columns to take (>0) or give (<0)
  if (need > 0) {
    while (need > 0 && after.length) {
      const next = after[0]
      if (cellWidth(next) <= need) {
        need -= cellWidth(next)
        after = after.slice(1)
      } else {
        after = [{ ...next, span: cellWidth(next) - need > 1 ? cellWidth(next) - need : undefined }, ...after.slice(1)]
        need = 0
      }
    }
  } else {
    after = [...Array.from({ length: -need }, () => ({ ...blankLike(cell), span: undefined })), ...after]
  }
  const rows = group.rows.map((r, i) => (i === ref.r ? [...before, withSpan(cell), ...after] : r))
  return settle(note, { ...note, groups: note.groups.map((gr, i) => (i === ref.g ? { ...gr, rows } : gr)) })
}

// The fill handle: a loose cell becomes a group of w x h, each cell a blank copy of
// the original (the original keeps its content in the top-left).
export function fillCell(note: Note, i: number, w: number, h: number): Note {
  const placed = note.cells[i]
  if (!placed || w < 1 || h < 1) return note
  const unit = cellWidth(placed.cell)
  const copies = Math.max(1, Math.floor(w / unit))
  const rows = Array.from({ length: h }, (_, r) =>
    Array.from({ length: copies }, (_, c) => (r === 0 && c === 0 ? placed.cell : blankLike(placed.cell))),
  )
  const group: Group = { x: placed.x, y: placed.y, variant: 'plain', rows }
  return settlePushing(note, { ...note, cells: note.cells.filter((_, k) => k !== i), groups: [...note.groups, group] }, { kind: 'group', i: note.groups.length })
}

// ---- column widths ----

const weightOf = (t: string) => (t === 'auto' ? 1 : Number.parseFloat(t))
// Column widths move in half grid squares: 0.5x, 1x, 1.5x, ... Hand-written fractions still load.
export const STEP = 0.5
const MIN_WEIGHT = STEP
const snap = (n: number) => Math.round(n / STEP) * STEP
const fr = (n: number) => `${Math.max(MIN_WEIGHT, snap(n))}fr`

// Drag the separator after column `i` by `delta` weight: the column on its left
// grows and the one on its right shrinks, so the total (and so the fit) is unchanged.
export function shiftSeparator(note: Note, i: number, delta: number): Note {
  if (i < 0 || i >= note.columns.length - 1) return note
  const a = weightOf(note.columns[i])
  const b = weightOf(note.columns[i + 1])
  // Snap the left column to a whole step; the right takes the difference.
  const left = Math.max(MIN_WEIGHT, Math.min(a + b - MIN_WEIGHT, snap(a + delta)))
  if (left === a) return note
  const columns = note.columns.map((t, k) => (k === i ? fr(left) : k === i + 1 ? fr(a + b - left) : t))
  return { ...note, columns }
}

// In a `right` note columns are not zero-sum (each is "this many cells wide").
export function setColumnWeight(note: Note, i: number, weight: number): Note {
  if (i < 0 || i >= note.columns.length) return note
  const w = Math.max(MIN_WEIGHT, snap(weight))
  if (weightOf(note.columns[i]) === w) return note
  return { ...note, columns: note.columns.map((t, k) => (k === i ? fr(w) : t)) }
}

// ---- adding things ----

// A bold, large, full-width heading in the first free row (down) or a two-column-wide
// one (right).
export function insertHeading(note: Note): Note {
  const span = note.flow === 'down' ? Math.max(1, note.columns.length) : 2
  const spot = firstFree(note, span, 1)
  if (!spot) return note
  const cell: Cell = { ...defaultCell('text'), span: span > 1 ? span : undefined, style: { bold: true, size: 'title' } }
  return settle(note, { ...note, cells: [...note.cells, { ...spot, cell }] })
}

// A single cell of the given type in the first free spot.
export function insertCell(note: Note, type: CellType): Note {
  const spot = firstFree(note, 1, 1)
  if (!spot) return note
  const cell = defaultCell(type)
  if (CARDY.includes(type)) cell.style = { fill: nextFill(note) }
  return settle(note, { ...note, cells: [...note.cells, { ...spot, cell }] })
}

// ---- keyboard-style navigation ----

export type Dir = 'up' | 'down' | 'left' | 'right'

export function neighbor(note: Note, ref: CellRef, dir: Dir): CellRef | null {
  const at = locate(note, ref)
  if (!at) return null
  const [x, y] =
    dir === 'up' ? [at.x, at.y - 1] : dir === 'down' ? [at.x, at.y + 1] : dir === 'left' ? [at.x - 1, at.y] : [at.x + at.w, at.y]
  return cellAt(note, x, y)?.ref ?? null
}

// The next cell in reading order (for Tab); wraps to the next row.
export function nextInOrder(note: Note, ref: CellRef, backwards = false): CellRef | null {
  const cells = allCells(note).sort((a, b) => a.y - b.y || a.x - b.x)
  const at = locate(note, ref)
  if (!at) return null
  const idx = cells.findIndex((c) => c.x === at.x && c.y === at.y)
  return cells[idx + (backwards ? -1 : 1)]?.ref ?? null
}

// Return in the last row of a group adds a row like it (blank), if there is room.
export function appendRowBelow(note: Note, ref: CellRef): Note {
  if (ref.in !== 'group') return note
  const g = note.groups[ref.g]
  const r = groupRect(g)
  return resizeGroup(note, ref.g, r.w, r.h + 1)
}
export const columnWeight = weightOf

// ---- columns ----

// Insert an empty column at index `at`: everything from `at` rightward shifts over,
// and anything straddling the new column grows to include it.
export function insertColumnAt(note: Note, at: number): Note {
  if (at < 0 || at > note.columns.length) return note
  const cells = note.cells.map((p) => {
    if (p.x >= at) return { ...p, x: p.x + 1 }
    if (p.x + cellWidth(p.cell) > at) return { ...p, cell: { ...p.cell, span: cellWidth(p.cell) + 1 } }
    return p
  })
  const groups = note.groups.map((g) => {
    const w = rowWidth(g.rows[0])
    if (g.x >= at) return { ...g, x: g.x + 1 }
    if (g.x + w <= at) return g
    // Straddled: each row gains a cell at the new column (a blank copy of its left neighbour).
    const rows = g.rows.map((row) => {
      let pos = g.x
      for (let ci = 0; ci < row.length; ci++) {
        const span = cellWidth(row[ci])
        if (pos === at) {
          const copy = { ...blankLike(row[ci - 1]), span: undefined }
          return [...row.slice(0, ci), copy, ...row.slice(ci)]
        }
        if (pos < at && at < pos + span) return row.map((c, k) => (k === ci ? { ...c, span: span + 1 } : c))
        pos += span
      }
      return row
    })
    return { ...g, rows }
  })
  const columns = [...note.columns]
  columns.splice(at, 0, '1fr')
  return settle(note, { ...note, columns, cells, groups })
}

// Delete column `i` and what is in it: cells there are removed, wider things shrink,
// and everything to the right shifts left.
export function deleteColumn(note: Note, i: number): Note {
  if (i < 0 || i >= note.columns.length || note.columns.length <= 1) return note
  const cells = note.cells.flatMap((p) => {
    const w = cellWidth(p.cell)
    if (p.x > i) return [{ ...p, x: p.x - 1 }]
    if (p.x + w <= i) return [p]
    return w > 1 ? [{ ...p, cell: { ...p.cell, span: w - 1 > 1 ? w - 1 : undefined } }] : []
  })
  const groups = note.groups.flatMap((g) => {
    const w = rowWidth(g.rows[0])
    if (g.x > i) return [{ ...g, x: g.x - 1 }]
    if (g.x + w <= i) return [g]
    const rows = g.rows.map((row) => {
      let pos = g.x
      const out: Cell[] = []
      for (const c of row) {
        const span = cellWidth(c)
        const covers = pos <= i && i < pos + span
        if (!covers) out.push(c)
        else if (span > 1) out.push({ ...c, span: span - 1 > 1 ? span - 1 : undefined })
        pos += span
      }
      return out
    })
    return rows[0].length === 0 ? [] : [{ ...g, rows }]
  })
  const columns = note.columns.filter((_, k) => k !== i)
  return { ...note, columns, cells, groups }
}

export const equalizeColumns = (note: Note): Note => ({ ...note, columns: note.columns.map(() => '1fr') })

// ---- duplicating ----

// Copy a group (content cleared) next to itself in the direction the note grows,
// else the other direction, else the first free spot.
export function duplicateGroupSmart(note: Note, g: number): Note {
  const src = note.groups[g]
  if (!src) return note
  const r = groupRect(src)
  const tries = note.flow === 'down' ? [[r.x, r.y + r.h], [r.x + r.w, r.y]] : [[r.x + r.w, r.y], [r.x, r.y + r.h]]
  for (const [x, y] of tries) {
    const next = duplicateGroup(note, g, x, y)
    if (next !== note) return next
  }
  const spot = firstFree(note, r.w, r.h)
  return spot ? duplicateGroup(note, g, spot.x, spot.y) : note
}

// Copy a loose cell (content cleared) next to itself.
export function duplicateLoose(note: Note, i: number): Note {
  const src = note.cells[i]
  if (!src) return note
  const w = cellWidth(src.cell)
  const tries = note.flow === 'down' ? [[src.x, src.y + 1], [src.x + w, src.y]] : [[src.x + w, src.y], [src.x, src.y + 1]]
  const spots = [...tries.map(([x, y]) => ({ x, y })), firstFree(note, w, 1)]
  for (const s of spots) {
    if (!s) continue
    const next = settlePushing(note, { ...note, cells: [...note.cells, { ...s, cell: blankLike(src.cell) }] }, { kind: 'cell', i: note.cells.length })
    if (next !== note) return next
  }
  return note
}

// ---- creating ----

// A new group of blank text cells covering w x h at (x, y), if that area is free.
export function createGroupAt(note: Note, x: number, y: number, w: number, h: number, variant: Variant = 'card'): Note {
  if (w < 1 || h < 1) return note
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => defaultCell('text')))
  return settle(note, { ...note, groups: [...note.groups, { x, y, variant, fill: nextFill(note), rows }] })
}

export const setGroupFill = (note: Note, g: number, fill: Group['fill']): Note => ({
  ...note,
  groups: note.groups.map((gr, i) => {
    if (i !== g) return gr
    const { fill: _drop, ...rest } = gr
    return fill ? { ...rest, fill } : rest
  }),
})

// ---- widget settings ----

// Change fields of a cell (a counter's label or goal, a rating's max, tag options).
export function patchCell(note: Note, ref: CellRef, patch: Record<string, unknown>): Note {
  return updateCell(note, ref, (c) => {
    const next = { ...c, ...patch } as Record<string, unknown>
    // Cleared optional fields (a label, a goal) disappear; a widget's own value/text never does.
    for (const k of Object.keys(next)) {
      if (k !== 'value' && k !== 'text' && (next[k] === undefined || next[k] === '')) delete next[k]
    }
    // A text field that is genuinely empty (a check's text) must stay a string.
    if (c.type === 'check') next.text = (patch.text as string | undefined) ?? c.text
    if (c.type === 'tag' && Array.isArray(next.options) && !next.options.includes(next.value)) next.value = (next.options as string[])[0]
    return next as unknown as Cell
  })
}

// A new row after row `r` of a group, shaped like it with the content cleared: "add
// another one like that". Whatever is below it moves down to make room.
export function insertRowAfterInGroup(note: Note, g: number, r: number): Note {
  const src = note.groups[g]
  if (!src || !src.rows[r]) return note
  const rows = [...src.rows]
  rows.splice(r + 1, 0, src.rows[r].map(blankLike))
  return settlePushing(note, { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, rows } : gr)) }, { kind: 'group', i: g })
}

// ---- shrinking a group ----

// Remove a row from a group. The last row takes the group with it.
export function deleteRowInGroup(note: Note, g: number, r: number): Note {
  const src = note.groups[g]
  if (!src || !src.rows[r]) return note
  if (src.rows.length === 1) return deleteGroup(note, g)
  const rows = src.rows.filter((_, i) => i !== r)
  return settle(note, { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, rows } : gr)) })
}

// Remove the grid column that cell (r, c) sits in, from every row of the group. A cell that spans
// the column gets narrower; one that only covers it goes. A one-column group goes entirely.
export function deleteColumnInGroup(note: Note, g: number, r: number, c: number): Note {
  const src = note.groups[g]
  const row = src?.rows[r]
  if (!src || !row?.[c]) return note
  const x = row.slice(0, c).reduce((n, cell) => n + (cell.span ?? 1), 0)
  if (rowWidth(row) <= 1) return deleteGroup(note, g)
  const rows = src.rows.map((cells) => {
    let at = 0
    const next: Cell[] = []
    for (const cell of cells) {
      const w = cell.span ?? 1
      if (x >= at && x < at + w) {
        if (w > 1) next.push({ ...cell, span: w - 1 > 1 ? w - 1 : undefined })
      } else next.push(cell)
      at += w
    }
    return next
  })
  return settle(note, { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, rows } : gr)) })
}

// ---- reordering rows ----

// Move row `from` of a group so it ends up at index `to`. The group does not move; its rows swap places.
export function moveRowInGroup(note: Note, g: number, from: number, to: number): Note {
  const src = note.groups[g]
  if (!src || from === to || from < 0 || to < 0 || from >= src.rows.length || to >= src.rows.length) return note
  const rows = [...src.rows]
  const [row] = rows.splice(from, 1)
  rows.splice(to, 0, row)
  return { ...note, groups: note.groups.map((gr, i) => (i === g ? { ...gr, rows } : gr)) }
}
