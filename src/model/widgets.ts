// Pure widget behaviour. Time is always passed in, never read, so it is testable.
import type { TimerCell } from './types'

export const timerElapsed = (t: TimerCell, now: number) =>
  t.ms + (t.since === null ? 0 : Math.max(0, now - t.since))

export const toggleTimer = (t: TimerCell, now: number): TimerCell =>
  t.since === null ? { ...t, since: now } : { ...t, ms: timerElapsed(t, now), since: null }

export const resetTimer = (t: TimerCell): TimerCell => ({ ...t, ms: 0, since: null })

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// ---- dates ----

const DAY = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface DateParts {
  weekday: string
  main: string
  // "Today", "Tomorrow", "Yesterday", or an offset like "in 3 days".
  relative: string
}

// Describe a YYYY-MM-DD date relative to `now`. Dates are calendar days, not instants.
export function describeDate(value: string, now: number): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const day = Date.UTC(y, mo, d)
  const today = new Date(now)
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((day - todayUtc) / DAY)
  const relative =
    diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : diff > 0 ? `in ${diff} days` : `${-diff} days ago`
  return { weekday: WEEKDAYS[new Date(day).getUTCDay()], main: `${MONTHS[mo]} ${d}`, relative }
}

// ---- tags ----

// Tags get a color by their position in the options list.
export const TAG_TONES = ['gray', 'orange', 'green', 'blue', 'purple', 'red'] as const
export const tagTone = (options: string[], value: string) => TAG_TONES[Math.max(0, options.indexOf(value)) % TAG_TONES.length]
export const nextTag = (options: string[], value: string) => options[(Math.max(0, options.indexOf(value)) + 1) % options.length]

// ---- rating / progress ----

export const toggleRating = (current: number, picked: number) => (current === picked ? 0 : picked)
export const clampProgress = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

// ---- countdown, habit, mood ----

export interface Countdown {
  // Whole days: positive until the date, negative after it, 0 on the day.
  days: number
  caption: string
}

export function describeCountdown(value: string, now: number): Countdown | null {
  const parts = describeDate(value, now)
  if (!parts) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)!
  const today = new Date(now)
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - todayUtc) / DAY)
  const caption = days === 0 ? 'today' : days > 0 ? (days === 1 ? 'day to go' : 'days to go') : days === -1 ? 'day ago' : 'days ago'
  return { days: Math.abs(days), caption }
}

export const HABIT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const toggleDay = (days: boolean[], i: number) => days.map((d, k) => (k === i ? !d : d))
export const habitCount = (days: boolean[]) => days.filter(Boolean).length

export const MOODS = ['Rough', 'Meh', 'Okay', 'Good', 'Great']
export const toggleMood = (current: number, picked: number) => (current === picked ? 0 : picked)

// Where a pointer is on a ring, as a 0-100 value, starting at the top and going clockwise.
export function ringValue(dx: number, dy: number): number {
  const turns = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1
  return Math.round(turns * 100)
}

// ---- countdown timers ----

export const timerRemaining = (t: TimerCell, now: number) => Math.max(0, (t.from ?? 0) - timerElapsed(t, now))
export const timerFinished = (t: TimerCell, now: number) => t.from !== undefined && timerElapsed(t, now) >= t.from
// What a timer shows: the time left when it counts down, the time so far when it counts up.
export const timerShown = (t: TimerCell, now: number) => (t.from !== undefined ? timerRemaining(t, now) : timerElapsed(t, now))

// ---- pips and bars ----

// Tapping a pip fills up to it; tapping the last filled one steps back by one.
export const setPips = (current: number, picked: number) => (picked === current ? picked - 1 : picked)

// Where in a bar column a pointer is, 0 (bottom) to 1 (top).
export function barHeight(clientY: number, top: number, height: number, max: number, step = 1): number {
  const frac = 1 - Math.max(0, Math.min(1, (clientY - top) / height))
  return Math.round((frac * max) / step) * step
}
export const setBar = (values: number[], i: number, v: number) => values.map((x, k) => (k === i ? v : x))

// ---- times and links ----

export interface Clock {
  hm: string
  ap: 'AM' | 'PM'
}
// "13:05" -> { hm: "1:05", ap: "PM" }
export function formatClock(value: string): Clock | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  return { hm: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, ap: h < 12 ? 'AM' : 'PM' }
}

// A link people typed without a scheme still opens. Anything that is not http(s) is refused.
export function normalizeUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}
export function linkLabel(url: string, text: string): string {
  if (text.trim()) return text
  const u = normalizeUrl(url)
  return u ? new URL(u).hostname.replace(/^www\./, '') : 'Add a link'
}
