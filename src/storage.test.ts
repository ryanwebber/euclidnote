import { describe, expect, it } from 'vitest'
import { Kv, MemoryBackend, adoptLocalNotes, isNoteKey, mergeIndexes } from './storage'

const fakeLocalStorage = (initial: Record<string, string>) => {
  const data = { ...initial }
  return {
    data,
    get length() {
      return Object.keys(data).length
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    getItem: (k: string) => data[k] ?? null,
    removeItem: (k: string) => void delete data[k],
  }
}

describe('Kv', () => {
  it('reads from memory at once and reaches the backend in order', async () => {
    const backend = new MemoryBackend()
    const kv = new Kv()
    await kv.attach(backend)
    kv.set('a', '1')
    kv.set('a', '2')
    kv.set('b', 'x')
    expect(kv.get('a')).toBe('2') // no waiting
    expect(backend.data).toEqual({}) // not yet written
    await kv.flush()
    expect(backend.data).toEqual({ a: '2', b: 'x' })
    kv.remove('a')
    await kv.flush()
    expect(backend.data).toEqual({ b: 'x' })
    expect(kv.get('a')).toBeNull()
  })
  it('loads what the backend already holds, and lists keys by prefix', async () => {
    const backend = new MemoryBackend()
    backend.data = { 'n:1': 'a', 'n:2': 'b', other: 'c' }
    const kv = new Kv()
    await kv.attach(backend)
    expect(kv.keys('n:').sort()).toEqual(['n:1', 'n:2'])
    expect(kv.get('other')).toBe('c')
  })
  it('keeps going, and remembers the error, when a write fails', async () => {
    const backend = new MemoryBackend()
    let fail = true
    backend.put = async (k, v) => {
      if (fail) throw new Error('quota')
      backend.data[k] = v
    }
    const kv = new Kv()
    await kv.attach(backend)
    kv.set('a', '1')
    await kv.flush()
    expect(kv.error).toBeTruthy()
    expect(kv.get('a')).toBe('1') // still readable this session
    fail = false
    kv.set('b', '2')
    await kv.flush()
    expect(backend.data).toEqual({ b: '2' })
  })
})

describe('the safety note for writes the database has not finished', () => {
  const journal = (initial: Record<string, string> = {}) => {
    const data = { ...initial }
    return {
      data,
      get length() {
        return Object.keys(data).length
      },
      key: (i: number) => Object.keys(data)[i] ?? null,
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    }
  }
  it('notes a write at once and forgets it once the database has it', async () => {
    const j = journal()
    const backend = new MemoryBackend()
    const kv = new Kv()
    await kv.attach(backend, j)
    kv.set('euclidnote:note:a', 'title: A\n')
    expect(j.data['euclidnote:journal:euclidnote:note:a']).toBe('title: A\n') // before the database write
    await kv.flush()
    expect(backend.data['euclidnote:note:a']).toBe('title: A\n')
    expect(j.data).toEqual({})
  })
  it('replays writes the last session never finished, including deletions', async () => {
    const backend = new MemoryBackend()
    backend.data = { 'euclidnote:note:gone': 'title: Gone\n', 'euclidnote:note:kept': 'title: Old\n' }
    const j = journal({
      'euclidnote:journal:euclidnote:note:kept': 'title: Newer\n',
      'euclidnote:journal:euclidnote:note:gone': '\u0000deleted',
      'euclidnote:journal:euclidnote:note:fresh': 'title: Fresh\n',
    })
    const kv = new Kv()
    await kv.attach(backend, j)
    expect(kv.get('euclidnote:note:kept')).toBe('title: Newer\n') // readable at once
    expect(kv.get('euclidnote:note:gone')).toBeNull()
    await kv.flush()
    expect(backend.data).toEqual({ 'euclidnote:note:kept': 'title: Newer\n', 'euclidnote:note:fresh': 'title: Fresh\n' })
    expect(j.data).toEqual({})
  })
  it('keeps the note when the database write fails, so the next launch can try again', async () => {
    const j = journal()
    const backend = new MemoryBackend()
    backend.put = async () => {
      throw new Error('full')
    }
    const kv = new Kv()
    await kv.attach(backend, j)
    const quiet = console.error
    console.error = () => undefined
    kv.set('a', '1')
    await kv.flush()
    console.error = quiet
    expect(j.data['euclidnote:journal:a']).toBe('1')
  })
  it('a newer write is not forgotten when an older one finishes', async () => {
    const j = journal()
    const kv = new Kv()
    await kv.attach(new MemoryBackend(), j)
    kv.set('a', '1')
    kv.set('a', '2')
    await kv.flush()
    expect(j.data).toEqual({})
    expect(kv.get('a')).toBe('2')
  })
})

describe('adopting notes from localStorage', () => {
  const idx = (...ids: string[]) => JSON.stringify(ids.map((id) => ({ id, title: id, updated: 1 })))
  it('moves notes and the index across, leaving preferences alone', async () => {
    const ls = fakeLocalStorage({
      'euclidnote:index': idx('a'),
      'euclidnote:note:a': 'title: A\n',
      'euclidnote:note': 'title: Old\n',
      'euclidnote:settings': '{"theme":"dark"}',
      'euclidnote:sidebar-hidden': '1',
    })
    const backend = new MemoryBackend()
    const kv = new Kv()
    await kv.attach(backend)
    expect(await adoptLocalNotes(kv, ls)).toBe(3)
    expect(backend.data).toEqual({ 'euclidnote:index': idx('a'), 'euclidnote:note:a': 'title: A\n', 'euclidnote:note': 'title: Old\n' })
    expect(Object.keys(ls.data).sort()).toEqual(['euclidnote:settings', 'euclidnote:sidebar-hidden'])
  })
  it('does not overwrite notes already in the store, and merges the index', async () => {
    const backend = new MemoryBackend()
    backend.data = { 'euclidnote:index': idx('a'), 'euclidnote:note:a': 'title: Newer\n' }
    const kv = new Kv()
    await kv.attach(backend)
    const ls = fakeLocalStorage({ 'euclidnote:index': idx('a', 'b'), 'euclidnote:note:a': 'title: Stale\n', 'euclidnote:note:b': 'title: B\n' })
    await adoptLocalNotes(kv, ls)
    expect(kv.get('euclidnote:note:a')).toBe('title: Newer\n')
    expect(kv.get('euclidnote:note:b')).toBe('title: B\n')
    expect(JSON.parse(kv.get('euclidnote:index')!).map((e: { id: string }) => e.id)).toEqual(['a', 'b'])
    expect(ls.length).toBe(0)
  })
  it('keeps the originals if the copy did not reach the database', async () => {
    const backend = new MemoryBackend()
    backend.put = async () => {
      throw new Error('full')
    }
    const kv = new Kv()
    await kv.attach(backend)
    const ls = fakeLocalStorage({ 'euclidnote:note:a': 'title: A\n' })
    const quiet = console.error
    console.error = () => undefined
    expect(await adoptLocalNotes(kv, ls)).toBe(0)
    console.error = quiet
    expect(ls.getItem('euclidnote:note:a')).toBe('title: A\n')
  })
  it('does nothing when there is nothing to move', async () => {
    const kv = new Kv()
    await kv.attach(new MemoryBackend())
    expect(await adoptLocalNotes(kv, fakeLocalStorage({}))).toBe(0)
  })
})

describe('helpers', () => {
  it('knows which keys hold notes', () => {
    for (const k of ['euclidnote:index', 'euclidnote:note', 'euclidnote:note:n1', 'euclidnote:demo:leg-day']) expect(isNoteKey(k)).toBe(true)
    for (const k of ['euclidnote:settings', 'euclidnote:sidebar-hidden', 'other']) expect(isNoteKey(k)).toBe(false)
  })
  it('merges indexes without duplicates, tolerating junk', () => {
    expect(mergeIndexes(null, '[{"id":"a"}]')).toBe('[{"id":"a"}]')
    expect(mergeIndexes('[{"id":"a"}]', '[{"id":"a"},{"id":"b"}]')).toBe('[{"id":"a"},{"id":"b"}]')
    expect(mergeIndexes('nope', 'also nope')).toBe('[]')
  })
})
