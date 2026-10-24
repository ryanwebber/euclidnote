import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseNote, serializeNote } from './format'

// Every file in examples/ is a hand-authored note; keep them all valid.
const dir = new URL('../../examples/', import.meta.url)
const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'))

describe('examples/', () => {
  it('has examples', () => expect(files.length).toBeGreaterThan(0))
  it.each(files)('%s parses and round-trips', (file) => {
    const note = parseNote(readFileSync(new URL(file, dir), 'utf8'))
    expect(parseNote(serializeNote(note))).toEqual(note)
  })
})
