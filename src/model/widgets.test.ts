import { describe, expect, it } from 'vitest'
import type { TimerCell } from './types'
import { formatDuration, resetTimer, timerElapsed, toggleTimer } from './widgets'

const timer: TimerCell = { type: 'timer', ms: 0, since: null }

describe('timer', () => {
  it('accrues time only while running', () => {
    const running = toggleTimer(timer, 1000)
    expect(timerElapsed(running, 6000)).toBe(5000)
    const paused = toggleTimer(running, 6000)
    expect(paused).toMatchObject({ ms: 5000, since: null })
    expect(timerElapsed(paused, 99999)).toBe(5000)
  })

  it('resumes from the banked time', () => {
    const resumed = toggleTimer({ ...timer, ms: 2000 }, 10000)
    expect(timerElapsed(resumed, 13000)).toBe(5000)
  })

  it('resets', () => {
    expect(resetTimer({ ...timer, ms: 5, since: 3 })).toMatchObject({ ms: 0, since: null })
  })
})

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65000)).toBe('1:05')
    expect(formatDuration(3600000)).toBe('1:00:00')
  })
})

import { clampProgress, describeDate, nextTag, tagTone, toggleRating } from './widgets'

describe('describeDate', () => {
  const noon = new Date(2026, 9, 23, 12).getTime() // Fri Oct 23, 2026
  it('describes today, tomorrow and yesterday', () => {
    expect(describeDate('2026-10-23', noon)).toEqual({ weekday: 'Fri', main: 'Oct 23', relative: 'Today' })
    expect(describeDate('2026-10-24', noon)?.relative).toBe('Tomorrow')
    expect(describeDate('2026-10-22', noon)?.relative).toBe('Yesterday')
  })
  it('counts days otherwise', () => {
    expect(describeDate('2026-10-30', noon)).toMatchObject({ weekday: 'Fri', relative: 'in 7 days' })
    expect(describeDate('2026-10-20', noon)?.relative).toBe('3 days ago')
  })
  it('is null for empty or malformed values', () => {
    expect(describeDate('', noon)).toBeNull()
    expect(describeDate('soon', noon)).toBeNull()
  })
})

describe('tags and ratings', () => {
  it('cycles options and wraps', () => {
    const o = ['A', 'B', 'C']
    expect(nextTag(o, 'A')).toBe('B')
    expect(nextTag(o, 'C')).toBe('A')
    expect(nextTag(o, 'missing')).toBe('B') // an unknown value counts as the first
  })
  it('colors a tag by its position', () => {
    expect(tagTone(['x', 'y', 'z'], 'x')).toBe('gray')
    expect(tagTone(['x', 'y', 'z'], 'z')).toBe('green')
  })
  it('tapping the current star clears the rating', () => {
    expect(toggleRating(3, 3)).toBe(0)
    expect(toggleRating(3, 4)).toBe(4)
  })
  it('keeps progress within 0 to 100', () => {
    expect(clampProgress(-4)).toBe(0)
    expect(clampProgress(133)).toBe(100)
    expect(clampProgress(41.6)).toBe(42)
  })
})

import { HABIT_DAYS, describeCountdown, habitCount, ringValue, toggleDay, toggleMood } from './widgets'

describe('countdown', () => {
  const noon = new Date(2026, 9, 23, 12).getTime()
  it('counts whole days to and since a date', () => {
    expect(describeCountdown('2026-12-25', noon)).toEqual({ days: 63, caption: 'days to go' })
    expect(describeCountdown('2026-10-24', noon)).toEqual({ days: 1, caption: 'day to go' })
    expect(describeCountdown('2026-10-23', noon)).toEqual({ days: 0, caption: 'today' })
    expect(describeCountdown('2026-10-20', noon)).toEqual({ days: 3, caption: 'days ago' })
    expect(describeCountdown('', noon)).toBeNull()
  })
})

describe('habit, mood and ring', () => {
  it('toggles one day and counts them', () => {
    const days = Array(7).fill(false)
    const next = toggleDay(toggleDay(days, 0), 4)
    expect(habitCount(next)).toBe(2)
    expect(next[0] && next[4] && !next[1]).toBe(true)
    expect(habitCount(toggleDay(next, 0))).toBe(1)
    expect(HABIT_DAYS).toHaveLength(7)
  })
  it('tapping the current mood clears it', () => {
    expect(toggleMood(4, 4)).toBe(0)
    expect(toggleMood(4, 2)).toBe(2)
  })
  it('reads a ring position clockwise from the top', () => {
    expect(ringValue(0, -10)).toBe(0) // straight up
    expect(ringValue(10, 0)).toBe(25) // right
    expect(ringValue(0, 10)).toBe(50) // down
    expect(ringValue(-10, 0)).toBe(75) // left
  })
})

import { barHeight, formatClock, linkLabel, normalizeUrl, setBar, setPips, timerFinished, timerRemaining, timerShown } from './widgets'

describe('countdown timers', () => {
  const t = { type: 'timer' as const, ms: 0, since: null as number | null, from: 90000 }
  it('shows time remaining and finishes at zero', () => {
    expect(timerShown(t, 0)).toBe(90000)
    const running = toggleTimer(t, 1000)
    expect(timerRemaining(running, 31000)).toBe(60000)
    expect(timerShown(running, 31000)).toBe(60000)
    expect(timerFinished(running, 31000)).toBe(false)
    expect(timerFinished(running, 91000)).toBe(true)
    expect(timerRemaining(running, 500000)).toBe(0) // never negative
  })
  it('a plain timer is unaffected', () => {
    const up = { type: 'timer' as const, ms: 5000, since: null }
    expect(timerShown(up, 0)).toBe(5000)
    expect(timerFinished(up, 1e9)).toBe(false)
  })
})

describe('pips, bars, time, links', () => {
  it('pips fill up to the tapped one; tapping the last filled steps back', () => {
    expect(setPips(0, 3)).toBe(3)
    expect(setPips(3, 3)).toBe(2)
    expect(setPips(1, 1)).toBe(0)
  })
  it('turns a pointer height into a bar value', () => {
    expect(barHeight(100, 100, 200, 10)).toBe(10) // top of the column
    expect(barHeight(300, 100, 200, 10)).toBe(0) // bottom
    expect(barHeight(200, 100, 200, 10)).toBe(5)
    expect(barHeight(-50, 100, 200, 10)).toBe(10) // clamped
    expect(setBar([1, 2, 3], 1, 9)).toEqual([1, 9, 3])
  })
  it('formats a 24 hour time as 12 hour', () => {
    expect(formatClock('09:15')).toEqual({ hm: '9:15', ap: 'AM' })
    expect(formatClock('13:05')).toEqual({ hm: '1:05', ap: 'PM' })
    expect(formatClock('00:30')).toEqual({ hm: '12:30', ap: 'AM' })
    expect(formatClock('12:00')).toEqual({ hm: '12:00', ap: 'PM' })
    expect(formatClock('')).toBeNull()
  })
  it('only opens real web links, adding https when it is missing', () => {
    expect(normalizeUrl('example.com/menu')).toBe('https://example.com/menu')
    expect(normalizeUrl('http://a.test')).toBe('http://a.test/')
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('   ')).toBeNull()
    expect(linkLabel('https://www.example.com/x', '')).toBe('example.com')
    expect(linkLabel('x', 'Menu')).toBe('Menu')
    expect(linkLabel('', '')).toBe('Add a link')
  })
})
