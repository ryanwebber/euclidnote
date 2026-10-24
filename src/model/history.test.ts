import { describe, expect, it } from 'vitest'
import { parseNote } from './format'
import { COALESCE_MS, emptyHistory, record, redo, undo } from './history'
import * as ops from './ops'

const n0 = parseNote('title: A\ngroups: []\n')
const n1 = ops.setTitle(n0, 'B')
const n2 = ops.setTitle(n1, 'C')

describe('history', () => {
  it('undoes and redoes in order', () => {
    let h = record(emptyHistory(), n0, 0)
    h = record(h, n1, 1000)
    const u = undo(h, n2)!
    expect(u.note).toBe(n1)
    const u2 = undo(u.history, u.note)!
    expect(u2.note).toBe(n0)
    expect(undo(u2.history, u2.note)).toBeNull()
    const r = redo(u2.history, u2.note)!
    expect(r.note).toBe(n1)
  })

  it('a new edit clears the redo stack', () => {
    let h = record(emptyHistory(), n0, 0)
    const u = undo(h, n1)!
    h = record(u.history, n0, 5000)
    expect(h.future).toEqual([])
  })

  it('folds edits with the same key inside the window into one step', () => {
    let h = record(emptyHistory(), n0, 0, 'text')
    h = record(h, n1, 300, 'text')
    h = record(h, n2, 600, 'text')
    expect(h.past).toEqual([n0])
  })

  it('does not fold across the window, different keys, or keyless edits', () => {
    let h = record(emptyHistory(), n0, 0, 'text')
    h = record(h, n1, COALESCE_MS + 1, 'text')
    expect(h.past).toHaveLength(2)
    h = record(h, n2, COALESCE_MS + 2, 'other')
    expect(h.past).toHaveLength(3)
    h = record(h, n2, COALESCE_MS + 3)
    h = record(h, n2, COALESCE_MS + 4)
    expect(h.past).toHaveLength(5)
  })
})
