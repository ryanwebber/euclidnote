// The list of notes. Pure: storage and the clock are passed in, so it is easy to test.
import { allRects, cellWidth, groupCells, groupRect, isTall } from './geometry'
import { columnWeight } from './ops'
import type { Fill, Note } from './types'

// Where the list and each note are kept in storage.
export const INDEX_KEY = 'euclidnote:index'
export const noteKey = (id: string) => `euclidnote:note:${id}`

export interface Entry {
  id: string
  title: string
  // Epoch ms of the last edit.
  updated: number
}

// ---- the index ----

export function parseIndex(text: string | null): Entry[] {
  if (!text) return []
  try {
    const raw: unknown = JSON.parse(text)
    if (!Array.isArray(raw)) return []
    return raw
      .filter((e): e is Entry => !!e && typeof e.id === 'string' && typeof e.title === 'string' && typeof e.updated === 'number')
      .map((e) => ({ id: e.id, title: e.title, updated: e.updated }))
  } catch {
    return []
  }
}

export const serializeIndex = (entries: Entry[]) => JSON.stringify(entries)

// Most recently edited first.
export const sortEntries = (entries: Entry[]): Entry[] => [...entries].sort((a, b) => b.updated - a.updated)

export const findEntry = (entries: Entry[], id: string | null) => entries.find((e) => e.id === id)

export function newId(entries: Entry[], random: () => number = Math.random): string {
  for (;;) {
    const id = 'n' + Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')
    if (!entries.some((e) => e.id === id)) return id
  }
}

export const addEntry = (entries: Entry[], entry: Entry): Entry[] => sortEntries([...entries.filter((e) => e.id !== entry.id), entry])
export const removeEntry = (entries: Entry[], id: string): Entry[] => entries.filter((e) => e.id !== id)

// Record an edit: new title and time. Unchanged titles still bump the time, so the list stays in edit order.
export const touch = (entries: Entry[], id: string, title: string, now: number): Entry[] =>
  entries.some((e) => e.id === id) ? sortEntries(entries.map((e) => (e.id === id ? { ...e, title, updated: now } : e))) : entries

// Where to go when the open note goes away: the next one down the list, else the one above.
export function neighborAfterRemoval(entries: Entry[], id: string): string | null {
  const i = entries.findIndex((e) => e.id === id)
  if (i < 0) return entries[0]?.id ?? null
  return (entries[i + 1] ?? entries[i - 1])?.id ?? null
}

export const duplicateTitle = (title: string) => (title.trim() ? `${title.trim()} copy` : 'Untitled copy')

// ---- a caricature of a note ----

// The thumbnail is the note's essence, not a picture of it: a handful of big regions of its main colors,
// in roughly the places they sit, filling a square however long or wide the note is.
//   cell  a region of one color
//   soft  a region of a group that has no color of its own
// Anything else is the background.
export interface Block {
  x: number
  y: number
  w: number
  h: number
  kind: 'cell' | 'soft'
  fill: Fill | null
}
export interface Sketch {
  width: number
  height: number
  blocks: Block[]
}
export const SKETCH_SIZE = 100
const N = 8 // the note is sampled on an 8x8 grid
const MAX_COLORS = 5
const TEXT_ROW = 0.42

// What fills a spot: a color name, 'soft' for an uncolored group, or null for nothing.
type Paint = Fill | 'soft' | null

export function sketch(note: Note): Sketch {
  const out: Sketch = { width: SKETCH_SIZE, height: SKETCH_SIZE, blocks: [] }
  const rects = allRects(note)
  if (rects.length === 0) return out
  const right = note.flow === 'right'
  const cols = Math.max(note.columns.length, ...rects.map((r) => r.x + r.w))
  const rows = Math.max(...rects.map((r) => r.y + r.h))

  // The note's real proportions (columns by weight, rows a line of text high unless they hold a widget), stretched to the square.
  const weights = Array.from({ length: cols }, (_, i) => (note.columns[i] ? columnWeight(note.columns[i]) : 1))
  const xs = [0]
  for (const w of weights) xs.push(xs[xs.length - 1] + w)
  const placed = [
    ...note.cells.map((p) => ({ cell: p.cell, x: p.x, y: p.y, w: cellWidth(p.cell), group: -1 })),
    ...note.groups.flatMap((gr, gi) => groupCells(gr).map((pc) => ({ cell: pc.cell, x: pc.x, y: pc.y, w: pc.w, group: gi }))),
  ]
  const tall = new Set(placed.filter((p) => isTall(p.cell)).map((p) => p.y))
  // Paint back to front: group surfaces, then cells with their own color. A plain heading paints nothing.
  type Spot = { x: number; y: number; w: number; h: number; paint: Paint }
  const raw: Spot[] = []
  for (const [gi, gr] of note.groups.entries()) {
    const r = groupRect(gr)
    if (gr.fill) raw.push({ ...r, paint: gr.fill })
    else if (!placed.some((p) => p.group === gi && p.cell.style?.fill)) raw.push({ ...r, paint: 'soft' })
  }
  for (const p of placed) if (p.cell.style?.fill) raw.push({ x: p.x, y: p.y, w: p.w, h: 1, paint: p.cell.style.fill })
  if (raw.length === 0) return out

  // Rows with nothing painted in them (a title, a heading between groups) take no room.
  const painted = new Set(raw.flatMap((r) => Array.from({ length: r.h }, (_, k) => r.y + k)))
  const ys = [0]
  for (let y = 0; y < rows; y++) ys.push(ys[y] + (!painted.has(y) ? 0 : right || tall.has(y) ? 1 : TEXT_ROW))
  const unit = (v: number, axis: number[]) => v / axis[axis.length - 1]
  const spots = raw.map((r) => ({
    x0: unit(xs[r.x], xs), x1: unit(xs[Math.min(cols, r.x + r.w)], xs), y0: unit(ys[r.y], ys), y1: unit(ys[r.y + r.h], ys), paint: r.paint,
  }))

  // Sample the middle of each square of the grid.
  let grid: Paint[][] = Array.from({ length: N }, (_, gy) =>
    Array.from({ length: N }, (_, gx) => {
      const cx = (gx + 0.5) / N
      const cy = (gy + 0.5) / N
      let paint: Paint = null
      for (const sp of spots) if (cx >= sp.x0 && cx < sp.x1 && cy >= sp.y0 && cy < sp.y1) paint = sp.paint
      return paint
    }),
  )

  // Keep only the main colors: the rest fade into what is around them.
  const area = new Map<Paint, number>()
  for (const row of grid) for (const p of row) if (p && p !== 'soft') area.set(p, (area.get(p) ?? 0) + 1)
  const keep = new Set([...area.entries()].sort((p, q) => q[1] - p[1]).slice(0, MAX_COLORS).map(([c]) => c))
  const neighbors = (gx: number, gy: number) =>
    [[gx - 1, gy], [gx + 1, gy], [gx, gy - 1], [gx, gy + 1]].flatMap(([x, y]) => (x >= 0 && y >= 0 && x < N && y < N ? [grid[y][x]] : []))
  const majority = (list: Paint[]): Paint => {
    const n = new Map<Paint, number>()
    for (const p of list) n.set(p, (n.get(p) ?? 0) + 1)
    return [...n.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? null
  }
  const main = (p: Paint) => p === 'soft' || (p !== null && keep.has(p))
  // A color that was dropped becomes the nearest kept one, looking further out until something is found.
  const nearest = (gx: number, gy: number): Paint => {
    for (let d = 1; d < N; d++) {
      const ring: Paint[] = []
      for (let y = gy - d; y <= gy + d; y++)
        for (let x = gx - d; x <= gx + d; x++)
          if (Math.max(Math.abs(x - gx), Math.abs(y - gy)) === d && x >= 0 && y >= 0 && x < N && y < N && main(grid[y][x])) ring.push(grid[y][x])
      if (ring.length) return majority(ring)
    }
    return null
  }
  // Scanning in reading order, it takes the color to its left, else above, so a color spreads as a clean block.
  const resolved = grid.map((row) => [...row])
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const p = grid[gy][gx]
      if (!p || main(p)) continue
      const left = gx > 0 ? resolved[gy][gx - 1] : null
      const up = gy > 0 ? resolved[gy - 1][gx] : null
      resolved[gy][gx] = left && main(left) ? left : up && main(up) ? up : nearest(gx, gy)
    }
  }
  grid = resolved
  // A square with no neighbor of its own paint is a speck, and takes the paint around it.
  grid = grid.map((row, gy) =>
    row.map((p, gx) => {
      const near = neighbors(gx, gy)
      return p && !near.includes(p) ? majority(near.filter((q) => q !== p)) : p
    }),
  )

  // Merge squares of one paint into rectangles: across, then as far down as the whole run goes.
  const done = grid.map((row) => row.map(() => false))
  const size = SKETCH_SIZE / N
  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const paint = grid[gy][gx]
      if (!paint || done[gy][gx]) continue
      let w = 1
      while (gx + w < N && grid[gy][gx + w] === paint && !done[gy][gx + w]) w++
      let h = 1
      while (gy + h < N && Array.from({ length: w }, (_, k) => k).every((k) => grid[gy + h][gx + k] === paint && !done[gy + h][gx + k])) h++
      for (let y = gy; y < gy + h; y++) for (let x = gx; x < gx + w; x++) done[y][x] = true
      out.blocks.push({ x: gx * size, y: gy * size, w: w * size, h: h * size, kind: paint === 'soft' ? 'soft' : 'cell', fill: paint === 'soft' ? null : paint })
    }
  }
  return out
}

// ---- time ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function relativeTime(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000))
  if (s < 45) return 'Just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const days = Math.floor(now / 86_400_000) - Math.floor(then / 86_400_000)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  const d = new Date(then)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
}
