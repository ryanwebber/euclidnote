import { describe, expect, it } from 'vitest'
import { parseNote } from './format'
import * as lib from './library'

const E = (id: string, updated: number, title = id): lib.Entry => ({ id, title, updated })

describe('the index', () => {
  it('round-trips and ignores junk', () => {
    const entries = [E('a', 2), E('b', 1)]
    expect(lib.parseIndex(lib.serializeIndex(entries))).toEqual(entries)
    expect(lib.parseIndex(null)).toEqual([])
    expect(lib.parseIndex('not json')).toEqual([])
    expect(lib.parseIndex('{"a":1}')).toEqual([])
    expect(lib.parseIndex('[{"id":"a"},{"id":"b","title":"B","updated":3}]')).toEqual([E('b', 3, 'B')])
  })
  it('orders by last edit and moves a touched note to the front', () => {
    const entries = lib.sortEntries([E('a', 1), E('b', 3), E('c', 2)])
    expect(entries.map((e) => e.id)).toEqual(['b', 'c', 'a'])
    const next = lib.touch(entries, 'a', 'Renamed', 10)
    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(next[0]).toEqual(E('a', 10, 'Renamed'))
    expect(lib.touch(entries, 'zzz', 'x', 10)).toBe(entries)
  })
  it('adds, removes and never reuses an id', () => {
    const entries = [E('n000000', 1)]
    const seq = [0, 0.5]
    expect(lib.newId(entries, () => seq.shift() ?? 0.9)).not.toBe('n000000') // the first draw collides, so it draws again
    expect(lib.addEntry(entries, E('b', 5)).map((e) => e.id)).toEqual(['b', 'n000000'])
    expect(lib.removeEntry(entries, 'n000000')).toEqual([])
  })
  it('picks a neighbor when the open note is removed', () => {
    const entries = [E('a', 3), E('b', 2), E('c', 1)]
    expect(lib.neighborAfterRemoval(entries, 'a')).toBe('b')
    expect(lib.neighborAfterRemoval(entries, 'c')).toBe('b')
    expect(lib.neighborAfterRemoval([E('a', 1)], 'a')).toBeNull()
  })
  it('names a copy', () => {
    expect(lib.duplicateTitle('Leg day')).toBe('Leg day copy')
    expect(lib.duplicateTitle('  ')).toBe('Untitled copy')
  })
})

describe('sketch', () => {
  const covered = (s: lib.Sketch) => s.blocks.reduce((n, b) => n + b.w * b.h, 0) / (lib.SKETCH_SIZE * lib.SKETCH_SIZE)
  const inside = (s: lib.Sketch) => s.blocks.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= lib.SKETCH_SIZE + 0.01 && b.y + b.h <= lib.SKETCH_SIZE + 0.01)

  it('turns a long note of one color into one big region that fills the square', () => {
    const rows = Array.from({ length: 40 }, () => '      - [a, b]\n').join('')
    const s = lib.sketch(parseNote('columns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    fill: blue\n    rows:\n' + rows))
    expect(s.blocks).toHaveLength(1)
    expect(s.blocks[0]).toMatchObject({ kind: 'cell', fill: 'blue' })
    expect(covered(s)).toBeGreaterThan(0.95)
  })
  it('keeps the main colors in roughly their places, and drops the detail', () => {
    const note = parseNote('columns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    variant: tiles\n    rows:\n      - [{counter: 1, fill: yellow}, {timer: 0, fill: indigo}]\n      - [{counter: 1, fill: yellow}, {timer: 0, fill: indigo}]\n')
    const s = lib.sketch(note)
    expect(s.blocks).toHaveLength(2)
    const yellow = s.blocks.find((b) => b.fill === 'yellow')!
    const indigo = s.blocks.find((b) => b.fill === 'indigo')!
    expect(yellow.x).toBeLessThan(indigo.x)
    expect(covered(s)).toBeGreaterThan(0.95)
  })
  it('stays simple for a busy note: a few colors, a few regions', () => {
    const colors = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink']
    const rows = colors.map((c, i) => `      - [{text: a, fill: ${c}}, {text: b, fill: ${colors[(i + 3) % 10]}}]\n`).join('')
    const s = lib.sketch(parseNote('columns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n' + rows))
    expect(new Set(s.blocks.map((b) => b.fill)).size).toBeLessThanOrEqual(5)
    expect(s.blocks.length).toBeLessThanOrEqual(24)
  })
  it('ignores a heading with no color, so the colors fill the square', () => {
    const note = parseNote('columns: [1fr, 1fr]\ncells:\n  - {at: [0, 0], span: 2, text: Title}\ngroups:\n  - at: [0, 1]\n    variant: tiles\n    rows:\n      - [{counter: 1, fill: yellow}, {timer: 0, fill: indigo}]\n')
    const s = lib.sketch(note)
    expect(Math.min(...s.blocks.map((b) => b.y))).toBe(0)
    expect(covered(s)).toBeGreaterThan(0.95)
  })
  it('shows an uncolored group as a soft region', () => {
    const s = lib.sketch(parseNote('columns: [1fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [a, b]\n      - [c, d]\n'))
    expect(s.blocks.map((b) => b.kind)).toEqual(['soft'])
  })
  it('keeps column weights and stays inside the square', () => {
    const note = parseNote('columns: [3fr, 1fr]\ngroups:\n  - at: [0, 0]\n    rows:\n      - [{text: a, fill: red}, {text: b, fill: green}]\n')
    const s = lib.sketch(note)
    const red = s.blocks.find((b) => b.fill === 'red')!
    const green = s.blocks.find((b) => b.fill === 'green')!
    expect(red.w).toBeGreaterThan(green.w * 2)
    expect(inside(s)).toBe(true)
  })
  it('fits a sideways note into the same square', () => {
    const note = parseNote('flow: right\ncolumns: [1fr, 2fr, 1fr, 2fr, 1fr, 2fr]\ngroups:\n  - at: [0, 0]\n    fill: pink\n    rows:\n      - [a, b, c, d, e, f]\n      - [a, b, c, d, e, f]\n')
    const s = lib.sketch(note)
    expect(inside(s)).toBe(true)
    expect(covered(s)).toBeGreaterThan(0.95)
  })
  it('handles an empty note', () => {
    expect(lib.sketch(parseNote('title: x\n')).blocks).toEqual([])
  })
})

describe('relativeTime', () => {
  const now = Date.UTC(2026, 9, 23, 12, 0, 0)
  it('reads naturally', () => {
    expect(lib.relativeTime(now - 10_000, now)).toBe('Just now')
    expect(lib.relativeTime(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(lib.relativeTime(now - 3 * 3_600_000, now)).toBe('3 hr ago')
    expect(lib.relativeTime(Date.UTC(2026, 9, 22, 8, 0, 0), now)).toBe('Yesterday')
    expect(lib.relativeTime(Date.UTC(2026, 9, 20, 9, 0, 0), now)).toBe('3 days ago')
    expect(lib.relativeTime(Date.UTC(2026, 8, 1, 9, 0, 0), now)).toBe('Sep 1')
  })
})
