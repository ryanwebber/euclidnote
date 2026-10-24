import { type PointerEvent as ReactPointerEvent, type RefObject, useRef, useState } from 'react'
import { type Rect, trackIndexAt } from '../model/geometry'
import type { Fill, Note, Selection, Variant } from '../model/types'
import { haptic } from '../hooks'

// What a drag would do if released now. `null` means "nothing to show or commit".
export interface Plan {
  next: Note
  valid: boolean
  // Where to draw the ghost (grid cells). Omit when `live` (the grid itself previews).
  rect?: Rect
  // The grid renders `next` directly while dragging (e.g. column widths).
  live?: boolean
  select?: Selection
  // Open this sheet once the edit is applied (e.g. choose a look for a group you just drew).
  then?: 'look'
  // What the ghost should look like at `rect`: the real outline of the thing being placed.
  shape?: { variant: Variant | 'cell'; fill?: Fill }
  // Rows (absolute) that will hold big widgets once the edit lands, so the preview is as tall as the result.
  tall?: number[]
  // A value that changes whenever the drag crosses a step (e.g. a column width), for a haptic tick.
  tick?: string
  // Folds repeated commits of the same kind into one undo step.
  key?: string
}

export interface At {
  col: number
  row: number
}
// `at` is the cell under the pointer, `origin` the cell it started on, and `topLeft(pt)` the cell the
// dragged item's top-left corner is over if the pointer is at `pt` (the item rides under your finger).
export interface DragContext {
  topLeft: (pt: { x: number; y: number }) => At
}
export type Planner = (at: At, pt: { x: number; y: number }, origin: At, ctx: DragContext) => Plan | null

const THRESHOLD = 4 // px before a press becomes a drag
const EDGE = 56 // px from the scroller's edge where auto-scroll starts
const DOCK = 70 // the dock covers the bottom of the scroller
const DWELL = 220 // ms the pointer must rest near an edge before the view starts to move
const MAX_SPEED = 520 // px per second at the very edge, whatever the display's refresh rate

const sizes = (v: string) => v.split(' ').map(Number.parseFloat).filter(Number.isFinite)

// Pointer-driven drags for every handle. `begin` is called from a handle's
// onPointerDown; a press that never moves is a tap (`onTap`).
export function useDrag(
  gridRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  onCommit: (plan: Plan) => void,
) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const busy = useRef(false)

  // The grid's track sizes. A drag measures them once, when it starts: the preview can reshape the
  // grid (a ghost with big widgets makes its rows taller), and hit-testing against that would
  // move the answer out from under the finger.
  const measure = () => {
    const el = gridRef.current
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      cols: sizes(cs.gridTemplateColumns),
      rows: sizes(cs.gridTemplateRows),
      gapX: Number.parseFloat(cs.columnGap) || 0,
      gapY: Number.parseFloat(cs.rowGap) || 0,
      padX: Number.parseFloat(cs.paddingLeft) || 0,
      padY: Number.parseFloat(cs.paddingTop) || 0,
    }
  }
  type Measure = NonNullable<ReturnType<typeof measure>>
  const hitWith = (m: Measure | null, x: number, y: number): At => {
    const el = gridRef.current
    if (!el || !m) return { col: 0, row: 0 }
    const box = el.getBoundingClientRect() // the position moves as you scroll; the sizes do not
    return {
      col: trackIndexAt(x - box.left - m.padX, m.cols, m.gapX),
      row: trackIndexAt(y - box.top - m.padY, m.rows, m.gapY),
    }
  }

  // The view eases into motion: nothing happens until the pointer has rested near an edge for a
  // moment, and then the speed grows with the square of how close to the edge it is.
  const autoscroll = (pt: { x: number; y: number }, edgeSince: { t: number | null; last: number }) => {
    const s = scrollRef.current
    if (!s) return
    const r = s.getBoundingClientRect()
    const push = (pos: number, lo: number, hi: number) => {
      if (pos < lo + EDGE) return -(Math.min(1, (lo + EDGE - pos) / EDGE) ** 2)
      if (pos > hi - EDGE) return Math.min(1, (pos - (hi - EDGE)) / EDGE) ** 2
      return 0
    }
    const dx = push(pt.x, r.left, r.right)
    const dy = push(pt.y, r.top, r.bottom - DOCK)
    if (dx === 0 && dy === 0) {
      edgeSince.t = null
      return
    }
    const now = performance.now()
    edgeSince.t ??= now
    const dt = Math.min(64, now - edgeSince.last) / 1000
    if (now - edgeSince.t < DWELL) return
    s.scrollBy(dx * MAX_SPEED * dt, dy * MAX_SPEED * dt)
  }

  // `frame` is the box the pointer is holding (default: the handle's parent), so the item rides under the finger as it was grabbed.
  // `onEnd` runs when the gesture is over, however it ended.
  const begin = (
    e: Pick<ReactPointerEvent<HTMLElement>, 'currentTarget' | 'pointerId' | 'clientX' | 'clientY' | 'stopPropagation'>,
    planner: Planner,
    onTap?: () => void,
    opts?: { frame?: HTMLElement | null; onEnd?: () => void },
  ) => {
    if (busy.current) return
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    busy.current = true
    const start = { x: e.clientX, y: e.clientY }
    const base = measure()
    const hit = (x: number, y: number) => hitWith(base, x, y)
    const origin = hit(start.x, start.y)
    // Where on the item you grabbed it: the handle sits inside the item's frame.
    const frame = (opts?.frame ?? el.parentElement)?.getBoundingClientRect()
    const grab = { x: frame ? start.x - frame.left : 0, y: frame ? start.y - frame.top : 0 }
    const ctx: DragContext = { topLeft: (pt) => hit(pt.x - grab.x + 8, pt.y - grab.y + 8) }
    let last = start
    let active = false
    let raf = 0
    let scrolled = ''
    let wasValid: boolean | undefined
    let wasTick: string | undefined
    const edgeSince: { t: number | null; last: number } = { t: null, last: performance.now() }

    const run = () => {
      const p = planner(hit(last.x, last.y), last, origin, ctx)
      setPlan(p)
      if (p && wasValid !== undefined && p.valid !== wasValid) haptic(6)
      if (p?.tick !== undefined && wasTick !== undefined && p.tick !== wasTick) haptic(4)
      wasValid = p?.valid
      wasTick = p?.tick
      return p
    }
    const tick = () => {
      autoscroll(last, edgeSince)
      edgeSince.last = performance.now()
      const s = scrollRef.current
      const key = s ? `${s.scrollLeft},${s.scrollTop}` : ''
      if (key !== scrolled) {
        scrolled = key
        run()
      }
      raf = requestAnimationFrame(tick)
    }
    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY }
      if (!active) {
        if (Math.hypot(last.x - start.x, last.y - start.y) < THRESHOLD) return
        active = true
        haptic(10)
        raf = requestAnimationFrame(tick)
      }
      run()
    }
    const finish = (cancelled: boolean) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
      el.removeEventListener('lostpointercapture', cancel)
      cancelAnimationFrame(raf)
      busy.current = false
      opts?.onEnd?.()
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        // Already released.
      }
      if (!active) {
        if (!cancelled) onTap?.()
        return
      }
      const p = cancelled ? null : planner(hit(last.x, last.y), last, origin, ctx)
      setPlan(null)
      if (p?.valid) {
        haptic(12)
        onCommit(p)
      }
    }
    const up = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY }
      finish(false)
    }
    const cancel = () => finish(true)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('lostpointercapture', cancel)
  }

  return { plan, begin }
}
