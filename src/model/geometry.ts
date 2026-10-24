// Placement geometry for the note's single grid. Pure: no DOM, no React.
import type { Cell, CellRef, Group, Note, Placed } from './types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Widgets that need a full square of height; a row holding one is tall, other rows are a line of text.
export const isTall = (c: Cell) => ['counter', 'timer', 'countdown', 'badge', 'bars'].includes(c.type) || (c.type === 'progress' && c.shape === 'ring')
export const cellWidth = (c: Cell) => c.span ?? 1
export const rowWidth = (row: Cell[]) => row.reduce((n, c) => n + cellWidth(c), 0)

export const groupRect = (g: Group): Rect => ({
  x: g.x,
  y: g.y,
  w: rowWidth(g.rows[0] ?? []),
  h: g.rows.length,
})
export const looseRect = (p: Placed): Rect => ({ x: p.x, y: p.y, w: cellWidth(p.cell), h: 1 })

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const allRects = (note: Note): Rect[] => [
  ...note.cells.map(looseRect),
  ...note.groups.map(groupRect),
]

// How far the content reaches: columns and rows used.
export function extent(note: Note): { cols: number; rows: number } {
  const rects = allRects(note)
  return {
    cols: Math.max(0, ...rects.map((r) => r.x + r.w)),
    rows: Math.max(0, ...rects.map((r) => r.y + r.h)),
  }
}

// Grow the column template so it covers the content (new columns are 1fr).
export function padColumns(note: Note): Note {
  const need = Math.max(1, extent(note).cols)
  return note.columns.length >= need
    ? note
    : { ...note, columns: [...note.columns, ...Array(need - note.columns.length).fill('1fr')] }
}

export interface PlacedCell {
  x: number
  y: number
  w: number
  cell: Cell
}

// Absolute positions of a group's cells.
export function groupCells(g: Group): (PlacedCell & { r: number; c: number })[] {
  return g.rows.flatMap((row, r) => {
    let x = g.x
    return row.map((cell, c) => {
      const placed = { r, c, x, y: g.y + r, w: cellWidth(cell), cell }
      x += placed.w
      return placed
    })
  })
}

// Which grid track a position (px from the grid's start) falls in. Positions past
// the last known track extrapolate using the last track's size, so a drag can
// reach tracks that do not exist yet.
export function trackIndexAt(pos: number, sizes: number[], gap: number): number {
  let start = 0
  for (let i = 0; i < sizes.length; i++) {
    if (pos < start + sizes[i] + gap / 2) return Math.max(0, i)
    start += sizes[i] + gap
  }
  const pitch = (sizes.at(-1) ?? 1) + gap
  return sizes.length + Math.floor((pos - (start - gap / 2)) / pitch)
}

export type Side = 'top' | 'bottom' | 'left' | 'right'

// Where a duplicate lands when its group's `side` handle is released over cell
// (col, row). The copy keeps the group's size, stays in line with it, and is
// pushed to the far side of the group if the pointer is still over the group.
export function duplicateTarget(side: Side, r: Rect, hit: { col: number; row: number }) {
  switch (side) {
    case 'bottom':
      return { x: r.x, y: Math.max(hit.row, r.y + r.h) }
    case 'top':
      return { x: r.x, y: Math.min(hit.row - r.h + 1, r.y - r.h) }
    case 'right':
      return { x: Math.max(hit.col, r.x + r.w), y: r.y }
    case 'left':
      return { x: Math.min(hit.col - r.w + 1, r.x - r.w), y: r.y }
  }
}

// The size a group takes when its corner is released over cell (col, row).
export const resizeTarget = (r: Rect, hit: { col: number; row: number }) => ({
  w: Math.max(1, hit.col - r.x + 1),
  h: Math.max(1, hit.row - r.y + 1),
})

// ---- locating cells ----

export interface Located {
  ref: CellRef
  x: number
  y: number
  w: number
}

// Every cell on the grid with its position, loose cells first.
export function allCells(note: Note): Located[] {
  return [
    ...note.cells.map((p, i): Located => ({ ref: { in: 'loose', i }, x: p.x, y: p.y, w: cellWidth(p.cell) })),
    ...note.groups.flatMap((g, gi) =>
      groupCells(g).map((pc): Located => ({ ref: { in: 'group', g: gi, r: pc.r, c: pc.c }, x: pc.x, y: pc.y, w: pc.w })),
    ),
  ]
}

export const locate = (note: Note, ref: CellRef): Located | undefined =>
  allCells(note).find((l) =>
    ref.in === 'loose'
      ? l.ref.in === 'loose' && l.ref.i === ref.i
      : l.ref.in === 'group' && l.ref.g === ref.g && l.ref.r === ref.r && l.ref.c === ref.c,
  )

// The cell covering grid position (x, y), if any.
export const cellAt = (note: Note, x: number, y: number): Located | undefined =>
  allCells(note).find((l) => l.y === y && x >= l.x && x < l.x + l.w)
