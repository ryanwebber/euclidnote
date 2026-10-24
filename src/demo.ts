// The /demo route: a sandbox with sample notes so changes can be followed along.
// Each sample keeps its own edits (separate storage key); Reset restores it.
import { STARTER } from './model/starter'

const raw = import.meta.glob('/examples/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const SAMPLES: Record<string, string> = Object.fromEntries(
  Object.entries(raw).map(([path, text]) => [path.split('/').pop()!.replace('.yaml', ''), text]),
)

export const isDemo = () => location.pathname.replace(/\/+$/, '').endsWith('/demo')
export const demoName = () => {
  const asked = new URLSearchParams(location.search).get('note')
  return asked && asked in SAMPLES ? asked : 'leg-day'
}

export const storageKey = () => (isDemo() ? `euclidnote:demo:${demoName()}` : 'euclidnote:note')
export const initialSource = () => (isDemo() ? SAMPLES[demoName()] : STARTER)
