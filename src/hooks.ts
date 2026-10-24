import { useEffect, useState } from 'react'
import { useSettings } from './settings'

// Publishes how much of the layout viewport the on-screen keyboard covers as
// --kb on the root element, so the dock can sit above it.
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb', `${Math.round(covered)}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}

export const haptic = (ms = 8) => {
  if (!useSettings.getState().haptics) return
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Not supported (iOS Safari); the visual feedback carries the interaction.
  }
}

// Current time, ticking while `active`.
export function useNow(active: boolean, every = 250) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(id)
  }, [active, every])
  return now
}

// True on screens wide enough for the desktop/iPad layout: a side inspector instead of a dock.
export const WIDE_QUERY = '(min-width: 900px)'
export function useWide() {
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

// Wide enough to keep the list of notes open beside the note (iPad landscape, desktop).
export const SIDEBAR_QUERY = '(min-width: 1100px)'
export function useSidebar() {
  const [on, setOn] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(SIDEBAR_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(SIDEBAR_QUERY)
    const change = () => setOn(mq.matches)
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [])
  return on
}

// The browser's "install this app" offer, when it makes one (Chrome and Edge do; Safari has Share > Add to Home Screen).
interface InstallEvent extends Event {
  prompt: () => Promise<void>
}
export function useInstallPrompt() {
  const [offer, setOffer] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      setOffer(e as InstallEvent)
    }
    const done = () => setOffer(null)
    window.addEventListener('beforeinstallprompt', on)
    window.addEventListener('appinstalled', done)
    return () => {
      window.removeEventListener('beforeinstallprompt', on)
      window.removeEventListener('appinstalled', done)
    }
  }, [])
  return offer
    ? {
        install: async () => {
          await offer.prompt()
          setOffer(null)
        },
      }
    : null
}
