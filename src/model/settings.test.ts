import { describe, expect, it } from 'vitest'
import { parseNote } from './format'
import * as s from './settings'

describe('settings', () => {
  it('round-trips and falls back to defaults on anything odd', () => {
    const custom: s.Settings = { theme: 'dark', haptics: false }
    expect(s.parseSettings(s.serializeSettings(custom))).toEqual(custom)
    expect(s.parseSettings(null)).toEqual(s.DEFAULT_SETTINGS)
    expect(s.parseSettings('nope')).toEqual(s.DEFAULT_SETTINGS)
    expect(s.parseSettings('{"theme":"neon","haptics":"yes"}')).toEqual(s.DEFAULT_SETTINGS)
    expect(s.parseSettings('{"theme":"light"}')).toEqual({ theme: 'light', haptics: true })
  })
})

describe('backups', () => {
  const ok = (source: string) => {
    try {
      parseNote(source)
      return true
    } catch {
      return false
    }
  }
  it('round-trips notes', () => {
    const notes = [{ title: 'A', updated: 5, source: 'title: A\n' }, { title: 'B', updated: 9, source: 'title: B\ncolumns: [1fr]\n' }]
    const file = s.makeBackup(notes, 100)
    expect(JSON.parse(file)).toMatchObject({ app: 'euclidnote', version: 1, exported: 100 })
    expect(s.parseBackup(file, ok)).toEqual({ notes, skipped: 0 })
  })
  it('skips notes that are not valid, and counts them', () => {
    const file = JSON.stringify({ app: 'euclidnote', version: 1, notes: [{ title: 'Good', updated: 1, source: 'title: Good\n' }, { title: 'Bad', source: 'columns: [oops' }, { title: 'Nothing' }] })
    const r = s.parseBackup(file, ok)
    expect(r.notes.map((n) => n.title)).toEqual(['Good'])
    expect(r.skipped).toBe(2)
  })
  it('refuses files that are not backups, or are from the future', () => {
    expect(() => s.parseBackup('hello', ok)).toThrow(s.BackupError)
    expect(() => s.parseBackup('{"app":"other","notes":[]}', ok)).toThrow(s.BackupError)
    expect(() => s.parseBackup('{"app":"euclidnote","version":9,"notes":[]}', ok)).toThrow(/newer/)
  })
})

describe('formatBytes', () => {
  it('reads naturally', () => {
    expect(s.formatBytes(512)).toBe('512 B')
    expect(s.formatBytes(2048)).toBe('2.0 KB')
    expect(s.formatBytes(50 * 1024)).toBe('50 KB')
    expect(s.formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})
