// Preferences, kept in storage and applied to the page.
import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings, THEME_COLORS, type Theme, parseSettings, serializeSettings } from './model/settings'

const KEY = 'euclidnote:settings'

const read = (): Settings => {
  try {
    return parseSettings(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_SETTINGS
  }
}

interface SettingsState extends Settings {
  open: boolean
}
export const useSettings = create<SettingsState>()(() => ({ ...read(), open: false }))

export const openSettings = (open = true) => useSettings.setState({ open })
export const setTheme = (theme: Theme) => update({ theme })
export const setHaptics = (haptics: boolean) => update({ haptics })

function update(patch: Partial<Settings>) {
  useSettings.setState(patch)
  const { theme, haptics } = useSettings.getState()
  try {
    localStorage.setItem(KEY, serializeSettings({ theme, haptics }))
  } catch {
    // Storage is full or blocked: the choice still holds for this visit.
  }
}

// "system" leaves the page to follow the device; light and dark force it (and the browser bar to match).
export function applyTheme(theme: Theme = useSettings.getState().theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const bars = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  const system = [THEME_COLORS.light, THEME_COLORS.dark]
  bars.forEach((meta, i) => meta.setAttribute('content', theme === 'system' ? system[i] ?? THEME_COLORS.light : THEME_COLORS[theme]))
}

export function initSettings() {
  applyTheme()
  useSettings.subscribe((s, prev) => s.theme !== prev.theme && applyTheme(s.theme))
}
