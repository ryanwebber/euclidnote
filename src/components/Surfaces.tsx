import type { ReactNode } from 'react'
import type { Rect } from '../model/geometry'
import type { Fill, Variant } from '../model/types'

export interface SurfaceSpec extends Rect {
  variant: Variant | 'cell'
  fill?: Fill
}

export const area = (r: Rect) => `${r.y + 1} / ${r.x + 1} / span ${r.h} / span ${r.w}`

// Looks that draw one surface behind the whole group.
const PANELS: Variant[] = ['card', 'table', 'header', 'sidebar', 'stripe']

// The surfaces that sit behind a group's cells. The same function draws the real thing and the
// ghost that previews it while dragging, so a preview always has the true outline of its look.
export function surfaces(s: SurfaceSpec, key: string, ghost = false): ReactNode[] {
  const cls = ghost ? ' ghosted' : ''
  const at = (r: Rect) => ({ gridArea: area(r) })
  const out: ReactNode[] = []
  const rowOf = (ri: number): Rect => ({ x: s.x, y: s.y + ri, w: s.w, h: 1 })

  if (s.variant === 'cell') {
    out.push(<div key={key} className={`tile-bg${cls}`} data-gfill={s.fill} style={at(s)} />)
  } else if (PANELS.includes(s.variant as Variant)) {
    out.push(
      <div key={key} className={`panel${cls}`} data-variant={s.variant} data-gfill={s.fill} style={at(s)}>
        {s.variant === 'stripe' && <i className="stripe" />}
      </div>,
    )
    if (s.variant === 'header') out.push(<div key={`${key}-head`} className={`band head-band${cls}`} data-gfill={s.fill} style={at(rowOf(0))} />)
    if (s.variant === 'sidebar') out.push(<div key={`${key}-side`} className={`band side-band${cls}`} data-gfill={s.fill} style={at({ x: s.x, y: s.y, w: 1, h: s.h })} />)
  } else if (s.variant === 'stack') {
    for (let r = 0; r < s.h; r++) out.push(<div key={`${key}-${r}`} className={`row-card${cls}`} data-gfill={s.fill} style={at(rowOf(r))} />)
  } else if (s.variant === 'outline') {
    out.push(<div key={key} className={`outline-box${cls}`} data-gfill={s.fill} style={at(s)} />)
  } else if (ghost && s.variant === 'tiles') {
    for (let r = 0; r < s.h; r++) for (let c = 0; c < s.w; c++) out.push(<div key={`${key}-${r}-${c}`} className={`tile-bg${cls}`} data-gfill={s.fill} style={at({ x: s.x + c, y: s.y + r, w: 1, h: 1 })} />)
  } else if (ghost) {
    out.push(<div key={key} className={`plain-box${cls}`} style={at(s)} />)
  }
  return out
}
