import { describe, expect, it } from 'vitest'
import { parseNote } from './format'
import { duplicateTarget, extent, groupCells, groupRect, resizeTarget, trackIndexAt } from './geometry'
import { STARTER } from './starter'

describe('trackIndexAt', () => {
  const sizes = [100, 100, 100]
  it('finds the track under a position, treating the gap as split between neighbours', () => {
    expect(trackIndexAt(10, sizes, 10)).toBe(0)
    expect(trackIndexAt(104, sizes, 10)).toBe(0) // in the first half of the gap
    expect(trackIndexAt(106, sizes, 10)).toBe(1)
    expect(trackIndexAt(250, sizes, 10)).toBe(2)
  })
  it('clamps before the start', () => {
    expect(trackIndexAt(-30, sizes, 10)).toBe(0)
  })
  it('extrapolates past the last track using its size', () => {
    // tracks start at 0, 110, 220; a 4th would start at 330, a 5th at 440
    expect(trackIndexAt(340, sizes, 10)).toBe(3)
    expect(trackIndexAt(450, sizes, 10)).toBe(4)
  })
})

describe('drag targets', () => {
  const r = { x: 1, y: 2, w: 2, h: 3 }
  it('bottom: below the group, in line with it, wherever the pointer is released', () => {
    expect(duplicateTarget('bottom', r, { col: 0, row: 7 })).toEqual({ x: 1, y: 7 })
    expect(duplicateTarget('bottom', r, { col: 2, row: 3 })).toEqual({ x: 1, y: 5 }) // still over the group
  })
  it('top: the copy ends at the pointer row, above the group', () => {
    expect(duplicateTarget('top', r, { col: 1, row: 1 })).toEqual({ x: 1, y: -1 })
    expect(duplicateTarget('top', { x: 0, y: 6, w: 1, h: 2 }, { col: 0, row: 3 })).toEqual({ x: 0, y: 2 })
  })
  it('right and left mirror that', () => {
    expect(duplicateTarget('right', r, { col: 6, row: 0 })).toEqual({ x: 6, y: 2 })
    expect(duplicateTarget('left', { x: 5, y: 0, w: 2, h: 1 }, { col: 2, row: 0 })).toEqual({ x: 1, y: 0 })
  })
  it('corner resizes to include the pointer cell, at least 1x1', () => {
    expect(resizeTarget(r, { col: 4, row: 6 })).toEqual({ w: 4, h: 5 })
    expect(resizeTarget(r, { col: 0, row: 0 })).toEqual({ w: 1, h: 1 })
  })
})

describe('geometry of a note', () => {
  const note = parseNote(STARTER)
  it('derives a group rect from its rows', () => {
    expect(groupRect(note.groups[0])).toEqual({ x: 0, y: 1, w: 3, h: 2 })
  })
  it('measures the content extent', () => {
    expect(extent(note)).toEqual({ cols: 3, rows: 3 })
  })
  it('lists a group cell positions', () => {
    const cells = groupCells(note.groups[0])
    expect(cells.map((c) => [c.x, c.y])).toEqual([[0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]])
  })
})
