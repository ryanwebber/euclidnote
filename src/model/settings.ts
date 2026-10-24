// The few preferences the app keeps. Pure: reading and writing storage happens elsewhere.
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export interface Settings {
  theme: Theme
  // Small buzzes on phones that support them.
  haptics: boolean
}
export const DEFAULT_SETTINGS: Settings = { theme: 'system', haptics: true }

export function parseSettings(text: string | null): Settings {
  if (!text) return DEFAULT_SETTINGS
  try {
    const raw = JSON.parse(text) as Partial<Settings> | null
    return {
      theme: THEMES.includes(raw?.theme as Theme) ? (raw!.theme as Theme) : DEFAULT_SETTINGS.theme,
      haptics: typeof raw?.haptics === 'boolean' ? raw.haptics : DEFAULT_SETTINGS.haptics,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}
export const serializeSettings = (s: Settings) => JSON.stringify(s)

// The browser-bar color for each theme (the page background).
export const THEME_COLORS = { light: '#ece7da', dark: '#121215' } as const

// ---- backups ----

export interface BackupNote {
  title: string
  updated: number
  source: string
}
export const BACKUP_APP = 'euclidnote'

export const makeBackup = (notes: BackupNote[], now: number) =>
  JSON.stringify({ app: BACKUP_APP, version: 1, exported: now, notes }, null, 2) + '\n'

export class BackupError extends Error {}

// Reads a backup file. Notes that are not text are dropped, and counted by the caller as skipped.
export function parseBackup(text: string, valid: (source: string) => boolean): { notes: BackupNote[]; skipped: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not a backup.')
  }
  const file = raw as { app?: unknown; version?: unknown; notes?: unknown }
  if (!file || file.app !== BACKUP_APP || !Array.isArray(file.notes)) throw new BackupError('That file is not an Euclidnote backup.')
  if (typeof file.version === 'number' && file.version > 1) throw new BackupError('That backup is from a newer version of the app.')
  const notes: BackupNote[] = []
  let skipped = 0
  for (const n of file.notes as Partial<BackupNote>[]) {
    if (n && typeof n.source === 'string' && valid(n.source)) {
      notes.push({ title: typeof n.title === 'string' ? n.title : 'Untitled', updated: typeof n.updated === 'number' ? n.updated : 0, source: n.source })
    } else skipped++
  }
  return { notes, skipped }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
