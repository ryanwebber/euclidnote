import { describe, expect, it } from 'vitest'
import { parseNote } from './format'
import { groupRect } from './geometry'
import * as ops from './ops'
import { layoutError } from './validate'
import { STARTER } from './starter'

const starter = () => parseNote(STARTER) // down; heading at (0,0) span 3; cards group at (0,1) 3x2
const right = (note = starter()) => ops.setFlow(note, 'right')
const gifts = () =>
  parseNote(`columns: [1fr, 1fr]
cells:
  - {at: [0, 0], span: 2, text: Mom, bold: true}
  - {at: [0, 3], span: 2, text: Dad, bold: true}
groups:
  - at: [0, 1]
    variant: cards
    rows:
      - [Scarf, "$30"]
      - [Book, "$15"]
`)

describe('duplicateGroup', () => {
  it('copies a group below with the content cleared', () => {
    const next = ops.duplicateGroup(starter(), 0, 0, 3)
    expect(next.groups).toHaveLength(2)
    const copy = next.groups[1]
    expect(groupRect(copy)).toEqual({ x: 0, y: 3, w: 3, h: 2 })
    expect(copy.variant).toBe('stack')
    expect(copy.rows[0][0]).toEqual({ type: 'text', text: '', style: { bold: true } })
    expect(copy.rows[0][1]).toMatchObject({ type: 'counter', value: 0, label: 'Reps' })
    expect(copy.rows[0][2]).toMatchObject({ type: 'timer', ms: 0, since: null })
  })

  it('may land anywhere free, not just adjacent', () => {
    expect(ops.duplicateGroup(starter(), 0, 0, 9).groups[1].y).toBe(9)
  })

  it('pushes what is in the way down, instead of refusing', () => {
    const note = starter() // heading at row 0, the group on rows 1-2
    const next = ops.duplicateGroup(note, 0, 0, 2) // lands on the group's own second row
    expect(next.groups).toHaveLength(2)
    expect(groupRect(next.groups[1])).toMatchObject({ x: 0, y: 2 }) // the copy is where it was asked to go
    expect(groupRect(next.groups[0])).toMatchObject({ y: 4 }) // the original, in its way, moves below it
    expect(next.cells[0]).toMatchObject({ y: 0 }) // the heading above, which does not overlap, stays
    expect(layoutError(next)).toBeNull()
  })

  it('pushes along the way a sideways note grows', () => {
    const note = parseNote('flow: right\ncolumns: [1fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a]\n  - at: [1, 0]\n    rows:\n      - [b]\n')
    const next = ops.duplicateGroup(note, 0, 1, 0) // onto b
    expect(next.groups.map((g) => g.x)).toEqual([0, 2, 1]) // b moved right; the copy sits at 1
  })

  it('still refuses what cannot work: past the column cap, or off the grid', () => {
    const note = parseNote('columns: [1fr, 1fr, 1fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b, c, d, e]\n')
    expect(ops.duplicateGroup(note, 0, 1, 0)).toBe(note)
  })

  it('the same pattern can sit on both sides of a heading', () => {
    // Mom's group above Dad's heading; duplicate it below the heading.
    const next = ops.duplicateGroup(gifts(), 0, 0, 4)
    expect(next.groups).toHaveLength(2)
    expect(next.groups[1].rows).toHaveLength(2)
  })

  it('cannot exceed the fit cap: a `down` note stays within 5 columns', () => {
    const note = starter()
    expect(ops.duplicateGroup(note, 0, 3, 1)).toBe(note) // would reach column 6
  })

  it('in a `right` note the rows are capped instead', () => {
    const note = right()
    expect(ops.duplicateGroup(note, 0, 0, 3).groups).toHaveLength(2) // rows 3-4: fits in 5
    expect(ops.duplicateGroup(note, 0, 0, 4)).toBe(note) // rows 4-5: needs 6 rows
    expect(ops.duplicateGroup(note, 0, 3, 1).groups).toHaveLength(2) // columns are free
  })
})

describe('resizeGroup', () => {
  it('growing repeats the last row with content cleared', () => {
    const next = ops.resizeGroup(starter(), 0, 3, 4)
    const rows = next.groups[0].rows
    expect(rows).toHaveLength(4)
    expect(rows[3][0]).toEqual({ type: 'text', text: '', style: { bold: true } })
    expect(rows[3][1]).toMatchObject({ type: 'counter', value: 0 })
  })

  it('growing wider repeats the last column and pads the column template', () => {
    const next = ops.resizeGroup(starter(), 0, 5, 2)
    expect(next.groups[0].rows.every((r) => r.length === 5)).toBe(true)
    expect(next.groups[0].rows[0][4].type).toBe('timer')
    expect(next.columns).toHaveLength(5)
  })

  it('shrinking drops cells from the end', () => {
    const next = ops.resizeGroup(starter(), 0, 2, 1)
    expect(next.groups[0].rows).toHaveLength(1)
    expect(next.groups[0].rows[0]).toHaveLength(2)
  })

  it('shrinks a spanning cell to fit instead of dropping it', () => {
    const note = parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [{text: Wide, span: 3}]\n')
    const next = ops.resizeGroup(note, 0, 2, 1)
    expect(next.groups[0].rows[0]).toEqual([{ type: 'text', text: 'Wide', span: 2 }])
  })

  it('pushes the next item down when it grows into it', () => {
    const note = gifts()
    const dad = note.cells.find((c) => c.cell.type === 'text' && c.cell.text === 'Dad')!
    const next = ops.resizeGroup(note, 0, 2, 3) // one row taller: into the "Dad" heading
    const moved = next.cells.find((c) => c.cell.type === 'text' && c.cell.text === 'Dad')!
    expect(moved.y).toBe(dad.y + 1)
    expect(next.groups[0].rows).toHaveLength(3)
    expect(layoutError(next)).toBeNull()
  })

  it('returns the same note for the rejected oversize case', () => {
    const note = starter()
    expect(ops.resizeGroup(note, 0, 6, 2)).toBe(note)
  })
})

describe('loose cells and groups', () => {
  it('addCell fills a free slot and rejects an occupied one', () => {
    const note = starter()
    const next = ops.addCell(note, 0, 5)
    expect(next.cells).toHaveLength(2)
    expect(ops.addCell(note, 1, 1)).toBe(note) // inside the group
  })

  it('groupCell wraps a loose cell so it can be repeated; ungroup undoes it', () => {
    const grouped = ops.groupCell(starter(), 0)
    expect(grouped.cells).toHaveLength(0)
    expect(grouped.groups[1]).toMatchObject({ x: 0, y: 0, variant: 'plain' })
    expect(groupRect(grouped.groups[1])).toEqual({ x: 0, y: 0, w: 3, h: 1 })
    const back = ops.ungroup(grouped, 1)
    expect(back.cells).toEqual(starter().cells)
  })

  it('insertGroup places a prefab in the first free spot, two cells along the fitted axis', () => {
    const down = ops.insertGroup(starter(), 'table').groups[1]
    expect(groupRect(down)).toEqual({ x: 0, y: 3, w: 2, h: 1 })
    const sideways = ops.insertGroup(right(), 'table').groups[1]
    expect(groupRect(sideways)).toEqual({ x: 3, y: 0, w: 1, h: 2 })
  })
})

describe('cells by reference', () => {
  it('edits loose and grouped cells', () => {
    const loose = { in: 'loose', i: 0 } as const
    const grouped = { in: 'group', g: 0, r: 1, c: 0 } as const
    let note = ops.setCellText(starter(), loose, 'Heavy day')
    note = ops.patchStyle(note, grouped, { italic: true })
    expect(ops.getCell(note, loose)).toMatchObject({ text: 'Heavy day' })
    expect(ops.getCell(note, grouped)?.style).toEqual({ bold: true, italic: true })
  })

  it('setCellType keeps style; patchStyle drops defaults', () => {
    const ref = { in: 'group', g: 0, r: 0, c: 0 } as const
    expect(ops.getCell(ops.setCellType(starter(), ref, 'timer'), ref)).toMatchObject({ type: 'timer', style: { bold: true } })
    expect(ops.getCell(ops.patchStyle(starter(), ref, { bold: false }), ref)?.style).toBeUndefined()
  })
})

describe('flow', () => {
  it('never moves a cell: only the flow changes', () => {
    const note = starter()
    const next = ops.setFlow(note, 'right')
    expect(next).toEqual({ ...note, flow: 'right' })
    expect(ops.setFlow(next, 'right')).toBe(next)
  })

  it('refuses a switch the content is too big for', () => {
    const tall = ops.duplicateGroup(ops.duplicateGroup(starter(), 0, 0, 3), 0, 0, 5) // 7 rows, down is fine
    expect(tall.groups).toHaveLength(3)
    expect(ops.canSetFlow(tall, 'right')).toBe(false)
    expect(ops.setFlow(tall, 'right')).toBe(tall)

    let wide = right()
    wide = ops.duplicateGroup(wide, 0, 3, 0)
    wide = ops.duplicateGroup(wide, 0, 6, 0) // 9 columns, right is fine
    expect(ops.canSetFlow(wide, 'down')).toBe(false)
  })
})

describe('purity', () => {
  it('never mutates its input', () => {
    const note = starter()
    const before = JSON.stringify(note)
    ops.duplicateGroup(note, 0, 0, 3)
    ops.resizeGroup(note, 0, 4, 5)
    ops.groupCell(note, 0)
    ops.ungroup(note, 0)
    ops.setFlow(note, 'right')
    expect(JSON.stringify(note)).toBe(before)
  })
})

describe('moving', () => {
  it('moves a group to a free spot and rejects overlaps', () => {
    const note = starter()
    expect(ops.moveGroup(note, 0, 0, 4).groups[0]).toMatchObject({ x: 0, y: 4 })
    expect(ops.moveGroup(note, 0, 0, 0)).toBe(note) // onto the heading
    expect(ops.moveGroup(note, 0, 0, 1)).toBe(note) // not moved at all
    expect(ops.moveGroup(note, 0, 1, 1).columns).toHaveLength(4) // 3 wide from column 1 reaches column 4: allowed
    expect(ops.moveGroup(note, 0, 3, 1)).toBe(note) // would reach column 6: over the cap
  })

  it('moves a loose cell', () => {
    const note = ops.addCell(starter(), 0, 5)
    expect(ops.moveLoose(note, 1, 2, 6).cells[1]).toMatchObject({ x: 2, y: 6 })
    expect(ops.moveLoose(note, 1, 0, 1)).toBe(note)
  })
})

describe('span', () => {
  it('widens a loose cell if there is room', () => {
    const note = ops.addCell(starter(), 0, 5)
    expect(ops.setSpan(note, { in: 'loose', i: 1 }, 3).cells[1].cell.span).toBe(3)
    expect(ops.setSpan(note, { in: 'loose', i: 1 }, 4).cells[1].cell.span).toBe(4) // columns pad up to 4
    expect(ops.setSpan(note, { in: 'loose', i: 1 }, 6)).toBe(note) // over the cap
  })

  it('in a group, widening takes room from the cells after it', () => {
    const note = starter() // group row: Squat | counter | timer
    const next = ops.setSpan(note, { in: 'group', g: 0, r: 0, c: 0 }, 2)
    expect(next.groups[0].rows[0].map((c) => c.type)).toEqual(['text', 'timer'])
    expect(next.groups[0].rows[0][0].span).toBe(2)
    expect(next.groups[0].rows[1]).toHaveLength(3) // other rows untouched
  })

  it('in a group, narrowing gives the room back as blank cells', () => {
    const wide = ops.setSpan(starter(), { in: 'group', g: 0, r: 0, c: 0 }, 2)
    const back = ops.setSpan(wide, { in: 'group', g: 0, r: 0, c: 0 }, 1)
    expect(back.groups[0].rows[0]).toHaveLength(3)
    expect(back.groups[0].rows[0][1]).toMatchObject({ type: 'text', text: '' })
  })

  it('cannot run past the right edge of the group', () => {
    const note = starter()
    expect(ops.setSpan(note, { in: 'group', g: 0, r: 0, c: 2 }, 2)).toBe(note)
  })
})

describe('fillCell', () => {
  it('turns a cell into a group of blank copies, keeping the original content', () => {
    let note = ops.addCell(starter(), 0, 4, 'counter')
    note = ops.updateCell(note, { in: 'loose', i: 1 }, (c) => (c.type === 'counter' ? { ...c, value: 7 } : c))
    const next = ops.fillCell(note, 1, 2, 3)
    expect(next.cells).toHaveLength(1)
    const g = next.groups[1]
    expect(groupRect(g)).toEqual({ x: 0, y: 4, w: 2, h: 3 })
    expect(g.rows[0][0]).toMatchObject({ type: 'counter', value: 7 })
    expect(g.rows[2][1]).toMatchObject({ type: 'counter', value: 0 })
  })

  it('pushes what is in the way', () => {
    const note = starter()
    const next = ops.fillCell(note, 0, 3, 3) // grows over the group below it
    expect(next).not.toBe(note)
    expect(layoutError(next)).toBeNull()
    expect(next.groups.find((g) => g.variant === 'stack')!.y).toBe(3)
  })
})

describe('column widths', () => {
  it('moving a separator is zero-sum', () => {
    const next = ops.shiftSeparator(starter(), 0, -1) // [2fr,1fr,1fr]
    expect(next.columns).toEqual(['1fr', '2fr', '1fr'])
  })

  it('setColumnWeight changes one column only', () => {
    expect(ops.setColumnWeight(starter(), 2, 2).columns).toEqual(['2fr', '1fr', '2fr'])
  })
})

describe('inserting', () => {
  it('a heading spans the width and is big and bold', () => {
    const next = ops.insertHeading(starter())
    expect(next.cells[1]).toMatchObject({ x: 0, y: 3, cell: { span: 3, style: { bold: true, size: 'title' } } })
  })

  it('a single cell lands in the first free spot', () => {
    const next = ops.insertCell(starter(), 'timer')
    expect(next.cells[1]).toMatchObject({ x: 0, y: 3, cell: { type: 'timer' } })
  })
})

describe('navigation', () => {
  const at = (x: number, y: number) => ({ in: 'group', g: 0, r: y - 1, c: x }) as const
  it('moves between neighbouring cells, across loose cells and groups', () => {
    const note = starter()
    expect(ops.neighbor(note, at(0, 1), 'right')).toEqual(at(1, 1))
    expect(ops.neighbor(note, at(1, 1), 'down')).toEqual(at(1, 2))
    expect(ops.neighbor(note, at(1, 1), 'up')).toEqual({ in: 'loose', i: 0 }) // the heading spans over it
    expect(ops.neighbor(note, at(2, 2), 'right')).toBeNull()
    expect(ops.neighbor(note, { in: 'loose', i: 0 }, 'down')).toEqual(at(0, 1))
  })

  it('tab order is reading order', () => {
    const note = starter()
    expect(ops.nextInOrder(note, { in: 'loose', i: 0 })).toEqual(at(0, 1))
    expect(ops.nextInOrder(note, at(2, 1))).toEqual(at(0, 2))
    expect(ops.nextInOrder(note, at(0, 1), true)).toEqual({ in: 'loose', i: 0 })
    expect(ops.nextInOrder(note, at(2, 2))).toBeNull()
  })

  it('return in the last row appends a row like it', () => {
    const next = ops.appendRowBelow(starter(), { in: 'group', g: 0, r: 1, c: 0 })
    expect(next.groups[0].rows).toHaveLength(3)
  })
})

describe('styles', () => {
  it('size and fill are stored and dropped when cleared', () => {
    const ref = { in: 'loose', i: 0 } as const
    let note = ops.patchStyle(starter(), ref, { size: 'large', fill: 'blue' })
    expect(ops.getCell(note, ref)?.style).toEqual({ bold: true, size: 'large', fill: 'blue' })
    note = ops.patchStyle(note, ref, { size: undefined, fill: undefined })
    expect(ops.getCell(note, ref)?.style).toEqual({ bold: true })
  })
})

describe('new widgets', () => {
  it('every type has a sensible default and blank', () => {
    for (const t of ['text', 'check', 'counter', 'timer', 'rating', 'progress', 'tag', 'date'] as const) {
      const c = ops.defaultCell(t)
      expect(c.type).toBe(t)
      expect(ops.blankLike(c)).toEqual(c)
    }
    expect(ops.blankLike({ type: 'check', checked: true, text: 'x' })).toMatchObject({ checked: false, text: '' })
    expect(ops.blankLike({ type: 'rating', value: 4, max: 5 })).toMatchObject({ value: 0 })
    expect(ops.blankLike({ type: 'tag', value: 'B', options: ['A', 'B'] })).toMatchObject({ value: 'A' })
  })

  it('switching between text and check keeps the text', () => {
    const ref = { in: 'loose', i: 0 } as const
    let note = ops.setCellText(starter(), ref, 'Milk')
    note = ops.setCellType(note, ref, 'check')
    expect(ops.getCell(note, ref)).toMatchObject({ type: 'check', text: 'Milk', style: { bold: true } })
    note = ops.setCellType(note, ref, 'rating')
    note = ops.setCellType(note, ref, 'text')
    expect(ops.getCell(note, ref)).toMatchObject({ type: 'text', text: '' })
  })

  it('patchCell changes widget settings and drops cleared ones', () => {
    const ref = { in: 'group', g: 0, r: 0, c: 1 } as const
    let note = ops.patchCell(starter(), ref, { label: 'Sets', goal: 10 })
    expect(ops.getCell(note, ref)).toMatchObject({ label: 'Sets', goal: 10 })
    note = ops.patchCell(note, ref, { label: '' })
    expect(ops.getCell(note, ref)).not.toHaveProperty('label')
  })

  it('patchCell keeps a tag valid when its options change', () => {
    const note = ops.setCellType(starter(), { in: 'loose', i: 0 }, 'tag')
    const next = ops.patchCell(note, { in: 'loose', i: 0 }, { options: ['A', 'B'] })
    expect(ops.getCell(next, { in: 'loose', i: 0 })).toMatchObject({ value: 'A', options: ['A', 'B'] })
  })

  it('a check keeps an empty text string', () => {
    const next = ops.patchCell(ops.setCellType(starter(), { in: 'loose', i: 0 }, 'check'), { in: 'loose', i: 0 }, { checked: true })
    expect(ops.getCell(next, { in: 'loose', i: 0 })).toMatchObject({ checked: true, text: 'Leg day' })
  })
})

describe('text styles', () => {
  it('font, border, icon, color, underline and strike are stored and cleared', () => {
    const ref = { in: 'loose', i: 0 } as const
    let note = ops.patchStyle(starter(), ref, { font: 'mono', border: 'thick', icon: 'star', color: 'red', underline: true, strike: true })
    expect(ops.getCell(note, ref)?.style).toEqual({ bold: true, font: 'mono', border: 'thick', icon: 'star', color: 'red', underline: true, strike: true })
    note = ops.patchStyle(note, ref, { font: undefined, border: undefined, icon: undefined, color: undefined, underline: false, strike: false })
    expect(ops.getCell(note, ref)?.style).toEqual({ bold: true })
  })
})

describe('columns', () => {
  it('inserting a column shifts what is to the right and widens what straddles it', () => {
    const next = ops.insertColumnAt(starter(), 1) // [2fr,1fr,1fr] -> 4 columns
    expect(next.columns).toEqual(['2fr', '1fr', '1fr', '1fr'])
    expect(next.cells[0].cell.span).toBe(4) // the heading spanned all three
    const g = next.groups[0]
    expect(g.rows[0]).toHaveLength(4)
    expect(g.rows[0][1]).toMatchObject({ type: 'text', text: '' }) // blank copy of its left neighbour
    expect(g.rows[0][2]).toMatchObject({ type: 'counter' })
  })

  it('inserting at the left edge shifts everything right', () => {
    const next = ops.insertColumnAt(starter(), 0)
    expect(next.groups[0].x).toBe(1)
    expect(next.cells[0].x).toBe(1)
  })

  it('a column inside a down note stops at the cap', () => {
    let note = starter()
    note = ops.insertColumnAt(ops.insertColumnAt(note, 3), 3) // 5 columns
    expect(note.columns).toHaveLength(5)
    expect(ops.insertColumnAt(note, 0)).toBe(note)
  })

  it('deleting a column removes its cells, shrinks what spans it, and shifts the rest left', () => {
    const next = ops.deleteColumn(starter(), 1)
    expect(next.columns).toEqual(['2fr', '1fr'])
    expect(next.cells[0].cell.span).toBe(2)
    expect(next.groups[0].rows[0].map((c) => c.type)).toEqual(['text', 'timer'])
  })

  it('deleting the only column of a group removes the group; the last column cannot be deleted', () => {
    const note = parseNote('columns: [1fr, 1fr]\ngroups:\n  - at: [1, 0]\n    rows:\n      - [a]\n')
    expect(ops.deleteColumn(note, 1).groups).toHaveLength(0)
    const one = parseNote('columns: [1fr]\ncells:\n  - {at: [0, 0], text: a}\n')
    expect(ops.deleteColumn(one, 0)).toBe(one)
  })

  it('equalizeColumns resets the widths', () => {
    expect(ops.equalizeColumns(starter()).columns).toEqual(['1fr', '1fr', '1fr'])
  })
})

describe('duplicating things', () => {
  it('duplicateGroupSmart copies in the direction the note grows', () => {
    const down = ops.duplicateGroupSmart(starter(), 0)
    expect(groupRect(down.groups[1])).toEqual({ x: 0, y: 3, w: 3, h: 2 })
    const sideways = ops.duplicateGroupSmart(right(), 0)
    expect(groupRect(sideways.groups[1])).toEqual({ x: 3, y: 1, w: 3, h: 2 })
  })

  it('goes below the original and pushes what is there', () => {
    const note = parseNote('columns: [1fr, 1fr, 1fr]\ncells:\n  - {at: [0, 1], span: 3, text: Wall}\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a]\n')
    const next = ops.duplicateGroupSmart(note, 0)
    expect(groupRect(next.groups[1])).toEqual({ x: 0, y: 1, w: 1, h: 1 })
    expect(next.cells[0].y).toBe(2) // the wall moved down one
  })

  it('falls back to another direction when pushing would go past a limit', () => {
    const note = parseNote('flow: right\ncolumns: [1fr, 1fr, 1fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a]\n      - [b]\n      - [c]\n      - [d]\n      - [e]\n')
    // below would be a sixth row, which a sideways note cannot fit; the copy goes beside it
    expect(groupRect(ops.duplicateGroupSmart(note, 0).groups[1])).toMatchObject({ x: 1, y: 0 })
  })

  it('duplicates a loose cell blank', () => {
    const next = ops.duplicateLoose(ops.setCellText(starter(), { in: 'loose', i: 0 }, 'x'), 0)
    expect(next.cells).toHaveLength(2)
    expect(next.cells[1].cell).toMatchObject({ type: 'text', text: '', style: { bold: true } })
  })
})

describe('creating', () => {
  it('createGroupAt makes a group of blank cells in a free area', () => {
    const next = ops.createGroupAt(starter(), 0, 3, 2, 2, 'table')
    expect(groupRect(next.groups[1])).toEqual({ x: 0, y: 3, w: 2, h: 2 })
    expect(next.groups[1].variant).toBe('table')
  })

  it('refuses an occupied area', () => {
    const note = starter()
    expect(ops.createGroupAt(note, 0, 1, 1, 1)).toBe(note)
  })

  it('a group tint can be set and cleared', () => {
    let note = ops.setGroupFill(starter(), 0, 'green')
    expect(note.groups[0].fill).toBe('green')
    note = ops.setGroupFill(note, 0, undefined)
    expect(note.groups[0]).not.toHaveProperty('fill')
  })
})

describe('insertRowAfterInGroup', () => {
  it('adds a blank row shaped like the chosen one', () => {
    const next = ops.insertRowAfterInGroup(starter(), 0, 0)
    expect(next.groups[0].rows).toHaveLength(3)
    expect(next.groups[0].rows[1][1]).toMatchObject({ type: 'counter', value: 0 })
    expect(next.groups[0].rows[2][0]).toMatchObject({ text: 'Lunge' }) // the later row moved down
  })
  it('moves what is directly below down, instead of doing nothing', () => {
    const note = ops.addCell(starter(), 0, 3)
    const next = ops.insertRowAfterInGroup(note, 0, 1)
    expect(next.groups[0].rows).toHaveLength(3)
    expect(next.cells.find((c) => c.x === 0 && c.y === 4)).toBeTruthy()
    expect(layoutError(next)).toBeNull()
  })

  it('still refuses when pushing would break a limit', () => {
    const note = parseNote('flow: right\ncolumns: [1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a]\n      - [b]\n      - [c]\n      - [d]\n      - [e]\n')
    expect(ops.insertRowAfterInGroup(note, 0, 0)).toBe(note) // a sixth row in a sideways note
  })
})

describe('round 3 widgets and column steps', () => {
  it('every new type has a default and a blank', () => {
    for (const t of ['toggle', 'number', 'mood', 'habit', 'countdown'] as const) {
      const c = ops.defaultCell(t)
      expect(c.type).toBe(t)
      expect(ops.blankLike(c)).toEqual(c)
    }
    expect(ops.blankLike({ type: 'toggle', on: true, text: 'x' })).toMatchObject({ on: false, text: '' })
    expect(ops.blankLike({ type: 'number', value: 5, unit: 'kg' })).toEqual({ type: 'number', value: null, unit: 'kg' })
    expect(ops.blankLike({ type: 'habit', days: Array(7).fill(true) })).toMatchObject({ days: Array(7).fill(false) })
  })

  it('text carries over to a toggle', () => {
    const ref = { in: 'loose', i: 0 } as const
    const note = ops.setCellType(ops.setCellText(starter(), ref, 'Wifi'), ref, 'toggle')
    expect(ops.getCell(note, ref)).toMatchObject({ type: 'toggle', text: 'Wifi' })
  })

  it('column widths move in half squares and never below half a square', () => {
    const note = starter() // [2fr, 1fr, 1fr]
    expect(ops.shiftSeparator(note, 0, -0.2)).toBe(note) // not yet a half step
    expect(ops.shiftSeparator(note, 0, -0.3).columns).toEqual(['1.5fr', '1.5fr', '1fr'])
    expect(ops.shiftSeparator(note, 0, -1).columns).toEqual(['1fr', '2fr', '1fr'])
    expect(ops.shiftSeparator(note, 0, 5).columns).toEqual(['2.5fr', '0.5fr', '1fr']) // the neighbour stops at half a square
    expect(ops.shiftSeparator(note, 1, 0.5).columns).toEqual(['2fr', '1.5fr', '0.5fr'])
    expect(ops.setColumnWeight(note, 1, 0.1).columns[1]).toBe('0.5fr')
    expect(ops.setColumnWeight(note, 1, 2.6).columns[1]).toBe('2.5fr')
    expect(ops.setColumnWeight(note, 1, 1.2)).toBe(note) // snaps back to 1: nothing changes
  })
})

describe('new things arrive in color', () => {
  it('prefab groups and sweeps take the next color, so neighbours differ', () => {
    const a = ops.insertGroup(starter(), 'card')
    const b = ops.insertGroup(a, 'card')
    expect(a.groups[1].fill).toBeDefined()
    expect(b.groups[2].fill).toBeDefined()
    expect(b.groups[2].fill).not.toBe(a.groups[1].fill)
    expect(ops.createGroupAt(starter(), 0, 3, 2, 1).groups[1].fill).toBeDefined()
  })

  it('card-like widgets get a fill; text and checkboxes stay plain', () => {
    expect(ops.insertCell(starter(), 'counter').cells[1].cell.style?.fill).toBeDefined()
    expect(ops.insertCell(starter(), 'timer').cells[1].cell.style?.fill).toBeDefined()
    expect(ops.insertCell(starter(), 'text').cells[1].cell.style).toBeUndefined()
    expect(ops.insertCell(starter(), 'check').cells[1].cell.style).toBeUndefined()
  })
})

describe('round 4 widgets', () => {
  it('every new type has a default and a blank', () => {
    for (const t of ['pips', 'time', 'link', 'badge', 'bars'] as const) {
      const c = ops.defaultCell(t)
      expect(c.type).toBe(t)
      expect(ops.blankLike(c)).toEqual(c)
    }
    expect(ops.blankLike({ type: 'pips', value: 3, max: 5 })).toMatchObject({ value: 0, max: 5 })
    expect(ops.blankLike({ type: 'bars', values: [1, 2, 3], max: 4 })).toEqual({ type: 'bars', values: [0, 0, 0], max: 4 })
    expect(ops.blankLike({ type: 'link', url: 'a.test', text: 'A' })).toMatchObject({ url: '', text: '' })
    expect(ops.blankLike({ type: 'badge', icon: 'plane' })).toEqual({ type: 'badge', icon: 'plane' }) // a badge is decoration
  })

  it('the words of a link carry over from text', () => {
    const ref = { in: 'loose', i: 0 } as const
    const note = ops.setCellType(ops.setCellText(starter(), ref, 'Menu'), ref, 'link')
    expect(ops.getCell(note, ref)).toMatchObject({ type: 'link', text: 'Menu' })
  })

  it('customizations survive duplication with the content cleared', () => {
    const ref = { in: 'loose', i: 0 } as const
    let note = ops.setCellType(starter(), ref, 'timer')
    note = ops.patchCell(note, ref, { from: 60000 })
    note = ops.duplicateLoose(note, 0)
    expect(note.cells[1].cell).toMatchObject({ type: 'timer', from: 60000, ms: 0, since: null })
  })
})

describe('shrinking a group', () => {
  const grid = () => parseNote('columns: [1fr, 1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b, c]\n      - [{text: d, span: 2}, e]\n      - [f, g, h]\n')
  it('deletes a row, and the last row takes the group', () => {
    const next = ops.deleteRowInGroup(grid(), 0, 1)
    expect(next.groups[0].rows.map((r) => r.length)).toEqual([3, 3])
    const one = parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n')
    expect(ops.deleteRowInGroup(one, 0, 0).groups).toHaveLength(0)
  })
  it('deletes a column from every row, narrowing cells that span it', () => {
    const next = ops.deleteColumnInGroup(grid(), 0, 0, 1) // the middle column
    expect(next.groups[0].rows.map((r) => r.map((c) => ('text' in c ? c.text : '?')))).toEqual([['a', 'c'], ['d', 'e'], ['f', 'h']])
    expect(next.groups[0].rows[1][0].span).toBeUndefined() // d was 2 wide, now 1
  })
  it('deleting the only column removes the group', () => {
    const one = parseNote('groups:\n  - at: [0, 0]\n    rows:\n      - [a]\n      - [b]\n')
    expect(ops.deleteColumnInGroup(one, 0, 0, 0).groups).toHaveLength(0)
  })
  it('ignores a cell that is not there', () => {
    const note = grid()
    expect(ops.deleteRowInGroup(note, 0, 9)).toBe(note)
    expect(ops.deleteColumnInGroup(note, 0, 0, 9)).toBe(note)
  })
})

describe('reordering rows', () => {
  const rows = () => parseNote('columns: [1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a]\n      - [b]\n      - [c]\n')
  const names = (n: ReturnType<typeof rows>) => n.groups[0].rows.map((r) => ('text' in r[0] ? r[0].text : '?'))
  it('moves a row to another place and keeps the rest in order', () => {
    expect(names(ops.moveRowInGroup(rows(), 0, 0, 2))).toEqual(['b', 'c', 'a'])
    expect(names(ops.moveRowInGroup(rows(), 0, 2, 0))).toEqual(['c', 'a', 'b'])
    expect(names(ops.moveRowInGroup(rows(), 0, 1, 0))).toEqual(['b', 'a', 'c'])
  })
  it('does nothing for the same place or a row that is not there', () => {
    const n = rows()
    expect(ops.moveRowInGroup(n, 0, 1, 1)).toBe(n)
    expect(ops.moveRowInGroup(n, 0, 5, 0)).toBe(n)
    expect(ops.moveRowInGroup(n, 0, 0, -1)).toBe(n)
    expect(ops.moveRowInGroup(n, 4, 0, 1)).toBe(n)
  })
})

describe('pushing cascades', () => {
  it('moves whatever the pushed items then run into, and leaves items that are not in the way', () => {
    const note = parseNote('columns: [1fr, 1fr]\ncells:\n  - {at: [0, 2], span: 2, text: B}\n  - {at: [0, 3], span: 2, text: C}\n  - {at: [0, 6], span: 2, text: Far}\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n      - [c, d]\n')
    const next = ops.insertRowAfterInGroup(note, 0, 1) // the group gains a row, so B must move down one, then C
    const y = (name: string) => next.cells.find((p) => p.cell.type === 'text' && p.cell.text === name)!.y
    expect([y('B'), y('C')]).toEqual([3, 4])
    expect(y('Far')).toBe(6) // not in the way: stays
    expect(layoutError(next)).toBeNull()
  })
})
