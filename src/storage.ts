// Where notes are kept: IndexedDB, behind a small key-value store that is read synchronously from memory.
//
// Everything is loaded once at startup, so the rest of the app can read and write without waiting. A write
// updates memory at once and is queued to the database in order; `flush()` waits for the queue. Notes are
// small text, so holding them all in memory is fine and keeps the app simple.
//
// If IndexedDB is not available (some private modes), localStorage is used instead.

export interface Backend {
  readonly kind: 'indexeddb' | 'localstorage' | 'memory'
  load(): Promise<Record<string, string>>
  put(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const
  data: Record<string, string> = {}
  async load() {
    return { ...this.data }
  }
  async put(key: string, value: string) {
    this.data[key] = value
  }
  async remove(key: string) {
    delete this.data[key]
  }
}

// A write goes to memory at once, but reaches the database a moment later, and a page can be closed or
// killed in between. So each write is also noted in localStorage, which is synchronous, until the database
// has it. The next launch replays anything still noted there. A deletion is noted as a tombstone.
const JOURNAL = 'euclidnote:journal:'
const TOMBSTONE = '\u0000deleted'

export class Kv {
  private mirror = new Map<string, string>()
  private queue: Promise<void> = Promise.resolve()
  private backend: Backend = new MemoryBackend()
  private journal: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'> | null = null
  // The last time a write to the database failed, if it did.
  error: unknown = null

  get kind() {
    return this.backend.kind
  }

  // Switch to a backend and load everything it holds, then replay writes the last session did not finish.
  async attach(backend: Backend, journal: Kv['journal'] = null) {
    this.backend = backend
    this.journal = journal
    this.mirror = new Map(Object.entries(await backend.load()))
    if (!journal) return
    const pending: string[] = []
    for (let i = 0; i < journal.length; i++) {
      const k = journal.key(i)
      if (k?.startsWith(JOURNAL)) pending.push(k.slice(JOURNAL.length))
    }
    for (const key of pending) {
      const value = journal.getItem(JOURNAL + key)
      if (value === null) continue
      if (value === TOMBSTONE) this.mirror.delete(key)
      else this.mirror.set(key, value)
      this.enqueueWrite(key, value)
    }
  }

  get(key: string): string | null {
    return this.mirror.get(key) ?? null
  }
  keys(prefix = ''): string[] {
    return [...this.mirror.keys()].filter((k) => k.startsWith(prefix))
  }
  set(key: string, value: string) {
    this.mirror.set(key, value)
    this.note(key, value)
    this.enqueueWrite(key, value)
  }
  remove(key: string) {
    if (!this.mirror.delete(key)) return
    this.note(key, TOMBSTONE)
    this.enqueueWrite(key, TOMBSTONE)
  }
  // Resolves when everything written so far has reached the database.
  flush(): Promise<void> {
    return this.queue
  }

  private note(key: string, value: string) {
    try {
      this.journal?.setItem(JOURNAL + key, value)
    } catch {
      // No room to note it: the database write below still happens.
    }
  }
  private enqueueWrite(key: string, value: string) {
    this.queue = this.queue
      .then(() => (value === TOMBSTONE ? this.backend.remove(key) : this.backend.put(key, value)))
      .then(() => {
        // Written. Forget the note, unless a newer write has replaced it.
        if (this.journal?.getItem(JOURNAL + key) === value) this.journal.removeItem(JOURNAL + key)
      })
      .catch((e) => {
        this.error = e
        console.error('Could not save to storage', e)
      })
  }
}

export const kv = new Kv()

// ---- IndexedDB ----

const DB_NAME = 'euclidnote'
const STORE = 'kv'

const request = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

export class IdbBackend implements Backend {
  readonly kind = 'indexeddb' as const
  private constructor(private db: IDBDatabase) {}

  static async open(factory: IDBFactory = indexedDB): Promise<IdbBackend> {
    const open = factory.open(DB_NAME, 1)
    // Version 1 of the database layout: one store of text values by key.
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    return new IdbBackend(await request(open))
  }

  async load() {
    const tx = this.db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
    return Object.fromEntries(keys.map((k, i) => [String(k), String(values[i])]))
  }
  async put(key: string, value: string) {
    const tx = this.db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    await done(tx)
  }
  async remove(key: string) {
    const tx = this.db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    await done(tx)
  }
}

// ---- localStorage (the fallback, and where older versions kept notes) ----

// The keys that hold notes. Preferences stay in localStorage, where they can be read before the page draws.
export const isNoteKey = (key: string) => key === 'euclidnote:index' || key.startsWith('euclidnote:note') || key.startsWith('euclidnote:demo:')

export class LocalBackend implements Backend {
  readonly kind = 'localstorage' as const
  constructor(private ls: Storage = localStorage) {}
  async load() {
    const out: Record<string, string> = {}
    for (let i = 0; i < this.ls.length; i++) {
      const key = this.ls.key(i)!
      if (isNoteKey(key)) out[key] = this.ls.getItem(key)!
    }
    return out
  }
  async put(key: string, value: string) {
    this.ls.setItem(key, value)
  }
  async remove(key: string) {
    this.ls.removeItem(key)
  }
}

// ---- moving notes out of localStorage ----

// Copy any notes older versions left in localStorage into the store, then clear them from localStorage.
// Nothing already in the store is overwritten, and the index is merged, so running this twice is harmless.
// Only after the copies have reached the database are the originals removed. Returns how many keys moved.
export async function adoptLocalNotes(store: Kv, ls: Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>): Promise<number> {
  const keys: string[] = []
  for (let i = 0; i < ls.length; i++) {
    const key = ls.key(i)
    if (key && isNoteKey(key)) keys.push(key)
  }
  for (const key of keys) {
    const value = ls.getItem(key)
    if (value === null) continue
    if (key === 'euclidnote:index') store.set(key, mergeIndexes(store.get(key), value))
    else if (store.get(key) === null) store.set(key, value)
  }
  await store.flush()
  if (store.error) return 0 // keep the originals if the copy failed
  for (const key of keys) ls.removeItem(key)
  return keys.length
}

export function mergeIndexes(current: string | null, incoming: string): string {
  const read = (text: string | null): { id: string }[] => {
    try {
      const v = JSON.parse(text ?? '[]')
      return Array.isArray(v) ? v : []
    } catch {
      return []
    }
  }
  const have = read(current)
  const ids = new Set(have.map((e) => e.id))
  return JSON.stringify([...have, ...read(incoming).filter((e) => e && typeof e.id === 'string' && !ids.has(e.id))])
}

// Pick the best backend, load it, and bring old notes across.
export async function openStorage(): Promise<Backend['kind']> {
  let backend: Backend
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB')
    backend = await IdbBackend.open()
  } catch {
    backend = new LocalBackend()
  }
  // Only the database needs the safety note; localStorage is already synchronous.
  await kv.attach(backend, backend.kind === 'indexeddb' ? localStorage : null)
  if (backend.kind === 'indexeddb') await adoptLocalNotes(kv, localStorage)
  return backend.kind
}
