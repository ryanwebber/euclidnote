import { extent, groupRect, looseRect, overlaps, rowWidth } from './geometry'
import { MAX_FIT, type Note } from './types'

// Returns why a note's layout is invalid, or null. Used by the parser and by every
// op that moves or sizes things, so an invalid layout can never be committed.
export function layoutError(note: Note): string | null {
  for (const [i, g] of note.groups.entries()) {
    const first = g.rows[0]
    if (!first || first.length === 0) return `groups[${i}] needs at least one row with a cell`
    const w = rowWidth(first)
    if (g.rows.some((r) => rowWidth(r) !== w)) {
      return `groups[${i}] rows must all cover the same number of columns`
    }
  }
  if (note.cells.some((p) => p.x < 0 || p.y < 0) || note.groups.some((g) => g.x < 0 || g.y < 0)) {
    return 'Items cannot sit at a negative position'
  }

  const items = [
    ...note.cells.map((p, i) => ({ name: `cells[${i}]`, r: looseRect(p) })),
    ...note.groups.map((g, i) => ({ name: `groups[${i}]`, r: groupRect(g) })),
  ]
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i].r, items[j].r)) return `${items[i].name} and ${items[j].name} overlap`
    }
  }

  const { cols, rows } = extent(note)
  if (note.flow === 'down' && Math.max(cols, note.columns.length) > MAX_FIT) {
    return `A note that scrolls down fits at most ${MAX_FIT} columns across`
  }
  if (note.flow === 'right' && rows > MAX_FIT) {
    return `A note that scrolls right fits at most ${MAX_FIT} rows down`
  }
  return null
}
