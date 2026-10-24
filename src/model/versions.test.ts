import { describe, expect, it } from 'vitest'
import { FORMAT_VERSION, VersionError, migrate, readVersion } from './versions'

describe('migrate', () => {
  // A pretend history: v1 notes had "name"; v2 renamed it "title"; v3 turned "tags" from text into a list.
  const history = {
    1: (d: Record<string, unknown>) => {
      const { name, ...rest } = d
      return { ...rest, title: name }
    },
    2: (d: Record<string, unknown>) => ({ ...d, tags: String(d.tags ?? '').split(',').filter(Boolean) }),
  }
  it('runs each step from the document’s version up to the current one, and drops the version key', () => {
    expect(migrate({ name: 'Trip', tags: 'a,b' }, history, 3)).toEqual({ title: 'Trip', tags: ['a', 'b'] })
    expect(migrate({ version: 2, title: 'Trip', tags: 'a' }, history, 3)).toEqual({ title: 'Trip', tags: ['a'] })
    expect(migrate({ version: 3, title: 'Trip', tags: ['a'] }, history, 3)).toEqual({ title: 'Trip', tags: ['a'] })
  })
  it('refuses a newer document and a gap in the history', () => {
    expect(() => migrate({ version: 4 }, history, 3)).toThrow(/newer version/)
    expect(() => migrate({ version: 1 }, {}, 3)).toThrow(/No way to upgrade a version 1/)
  })
  it('treats a missing version as 1, and rejects nonsense', () => {
    expect(readVersion({})).toBe(1)
    expect(readVersion({ version: 3 })).toBe(3)
    for (const v of [0, 1.5, 'x', -2]) expect(() => readVersion({ version: v })).toThrow(VersionError)
  })
  it('the real history is empty so far: today’s documents pass straight through', () => {
    expect(FORMAT_VERSION).toBe(1)
    expect(migrate({ title: 'x' })).toEqual({ title: 'x' })
  })
})
