// Dev builds fill the library with the example notes, so there is always something to look at.
// `?seed=add|reset|clear` manages it (see scripts/seed.mjs). Nothing here is part of a production build.
import { SAMPLES, isDemo } from './demo'
import { parseNote } from './model/format'
import { INDEX_KEY, type Entry, noteKey, parseIndex, serializeIndex } from './model/library'
import { kv } from './storage'

export type SeedAction = 'add' | 'reset' | 'clear'

const ORDER = ['leg-day', 'widgets', 'more', 'habits', 'looks', 'golf-yardages', 'gifts', 'grocery', 'lisbon-trip', 'empty']
const names = () => [...ORDER.filter((n) => n in SAMPLES), ...Object.keys(SAMPLES).filter((n) => !ORDER.includes(n)).sort()]

export const exampleId = (name: string) => `ex-${name}`

// The examples as library entries, the first being the newest.
export function exampleEntries(now = Date.now()): { entry: Entry; source: string }[] {
  return names().map((name, i) => {
    const source = SAMPLES[name]
    let title = name
    try {
      title = parseNote(source).title
    } catch {
      // keep the file name
    }
    return { entry: { id: exampleId(name), title, updated: now - i * 60_000 }, source }
  })
}

function seedAction(): SeedAction | null {
  const a = new URLSearchParams(location.search).get('seed')
  return a === 'add' || a === 'reset' || a === 'clear' ? a : null
}

// Fill the library with the examples before the app reads it. Called only from a dev build (see main.tsx),
// which is also the only place this file is ever loaded: production builds drop it entirely.
//   a first run, or ?seed=add   adds any example that is missing
//   ?seed=reset                 wipes every note, then adds them all
//   ?seed=clear                 wipes every note and leaves the library empty
export function applyDevSeed() {
  const action = seedAction()
  if (action === 'reset' || action === 'clear') {
    for (const k of kv.keys('euclidnote:')) if (k.startsWith('euclidnote:note') || k === INDEX_KEY) kv.remove(k)
    if (action === 'clear') kv.set(INDEX_KEY, '[]')
  }
  if (action) history.replaceState(null, '', location.pathname + location.hash)
  if (action === 'clear' || isDemo()) return
  const fresh = kv.get(INDEX_KEY) === null
  if (!fresh && action !== 'add' && action !== 'reset') return
  const entries = parseIndex(kv.get(INDEX_KEY))
  for (const { entry, source } of exampleEntries()) {
    if (entries.some((e) => e.id === entry.id)) continue
    kv.set(noteKey(entry.id), source)
    entries.push(entry)
  }
  kv.set(INDEX_KEY, serializeIndex(entries))
}
