import { describe, expect, it } from 'vitest'
import { SAMPLES } from './demo'
import { exampleEntries } from './devseed'

describe('dev examples', () => {
  it('turns every example into a library entry, newest first, with unique ids', () => {
    const list = exampleEntries(1_000_000)
    expect(list).toHaveLength(Object.keys(SAMPLES).length)
    expect(new Set(list.map((e) => e.entry.id)).size).toBe(list.length)
    expect(list[0].entry.id).toBe('ex-leg-day')
    expect(list.map((e) => e.entry.updated)).toEqual([...list.map((e) => e.entry.updated)].sort((a, b) => b - a))
    expect(list.every((e) => /^[\w-]+$/.test(e.entry.id) && e.entry.title.length > 0)).toBe(true)
  })
})
