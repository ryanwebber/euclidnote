// The hand-editable text format (YAML) used for authoring examples and prefabs,
// seeding tests, storage and eventual export. See docs/format.md. The app has no
// editor for it.
import { Document, isCollection, parse } from 'yaml'
import { padColumns } from './geometry'
import { FORMAT_VERSION, VersionError, migrate } from './versions'
import {
  type Align,
  BORDERS,
  LAYOUTS,
  type Layout,
  type Border,
  type Cell,
  type CellStyle,
  DEFAULT_TAG_OPTIONS,
  FILLS,
  FLOWS,
  FONTS,
  type Fill,
  type Flow,
  type Font,
  type Group,
  ICON_NAMES,
  type IconName,
  type Note,
  type Placed,
  SIZES,
  type Size,
  VARIANTS,
  VARIANT_ALIASES,
  type Variant,
} from './types'
import { layoutError } from './validate'

export class FormatError extends Error {}

const TRACK = /^(\d+(\.\d+)?fr|auto)$/
const ALIGNS: Align[] = ['left', 'center', 'right']
// Keys that make a cell a widget. A text cell has none of them.
const WIDGET_KEYS = [
  'counter', 'timer', 'check', 'toggle', 'link', 'badge', 'number', 'rating', 'mood', 'progress', 'pips', 'habit', 'bars',
  'tag', 'date', 'time', 'countdown',
] as const
// Widgets that also carry their own words in a `text` key.
const TEXT_WIDGETS = ['check', 'toggle', 'link']

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseNote(source: string): Note {
  let raw: unknown
  try {
    raw = parse(source)
  } catch (e) {
    throw new FormatError((e as Error).message)
  }
  if (!isObj(raw)) throw new FormatError('A note must be a mapping with "title", "cells" and "groups"')
  try {
    raw = migrate(raw)
  } catch (e) {
    if (e instanceof VersionError) throw new FormatError(e.message)
    throw e
  }
  if (!isObj(raw)) throw new FormatError('A note must be a mapping with "title", "cells" and "groups"')

  const flow = (raw.flow ?? 'down') as Flow
  if (!FLOWS.includes(flow)) throw new FormatError(`flow must be one of ${FLOWS.join(', ')}`)

  const list = (key: 'cells' | 'groups') => {
    const v = raw[key] ?? []
    if (!Array.isArray(v)) throw new FormatError(`"${key}" must be a list`)
    return v
  }
  const cells = list('cells').map((c, i) => parseLoose(c, `cells[${i}]`))
  const groups = list('groups').map((g, i) => parseGroup(g, `groups[${i}]`))

  let columns: string[] = []
  if (raw.columns !== undefined) {
    if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
      throw new FormatError('"columns" must be a non-empty list')
    }
    columns = raw.columns.map((t) => (typeof t === 'number' ? `${t}fr` : String(t)))
    const bad = columns.find((t) => !TRACK.test(t))
    if (bad) throw new FormatError(`columns: "${bad}" must look like 1fr, 2.5fr or auto`)
  }

  const note = padColumns({
    title: raw.title === undefined || raw.title === null ? 'Untitled' : String(raw.title),
    flow,
    columns,
    cells,
    groups,
  })
  const error = layoutError(note)
  if (error) throw new FormatError(error)
  return note
}

function parsePosition(raw: Obj, where: string): { x: number; y: number } {
  const at = raw.at
  if (!Array.isArray(at) || at.length !== 2 || !at.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new FormatError(`${where}.at must be [column, row] with non-negative whole numbers`)
  }
  return { x: at[0], y: at[1] }
}

function parseLoose(raw: unknown, where: string): Placed {
  if (!isObj(raw)) throw new FormatError(`${where} must be a mapping with "at" and a cell`)
  return { ...parsePosition(raw, where), cell: parseCell(raw, where) }
}

function parseGroup(raw: unknown, where: string): Group {
  if (!isObj(raw)) throw new FormatError(`${where} must be a mapping`)
  const named = String(raw.variant ?? 'plain')
  const variant = (VARIANT_ALIASES[named] ?? named) as Variant
  if (!VARIANTS.includes(variant)) {
    throw new FormatError(`${where}.variant must be one of ${VARIANTS.join(', ')}`)
  }
  if (raw.fill !== undefined && !FILLS.includes(raw.fill as Fill)) {
    throw new FormatError(`${where}.fill must be one of ${FILLS.join(', ')}`)
  }
  if (!Array.isArray(raw.rows)) throw new FormatError(`${where}.rows must be a list`)
  const rows = raw.rows.map((row, ri) => {
    if (!Array.isArray(row)) throw new FormatError(`${where}.rows[${ri}] must be a list of cells`)
    return row.map((c, ci) => parseCell(c, `${where}.rows[${ri}][${ci}]`))
  })
  return { ...parsePosition(raw, where), variant, ...(raw.fill ? { fill: raw.fill as Fill } : {}), rows }
}

function parseStyle(raw: Obj, where: string): CellStyle {
  const style: CellStyle = {}
  for (const k of ['bold', 'italic', 'underline', 'strike'] as const) if (raw[k] === true) style[k] = true
  const oneOf = <T extends string>(key: string, allowed: readonly T[]): T | undefined => {
    if (raw[key] === undefined) return undefined
    if (!allowed.includes(raw[key] as T)) throw new FormatError(`${where}.${key} must be one of ${allowed.join(', ')}`)
    return raw[key] as T
  }
  const align = oneOf<Align>('align', ALIGNS)
  if (align && align !== 'left') style.align = align
  const size = oneOf<Size>('size', SIZES)
  if (size) style.size = size
  const font = oneOf<Font>('font', FONTS)
  if (font) style.font = font
  const border = oneOf<Border>('border', BORDERS)
  if (border) style.border = border
  const layout = oneOf<Layout>('layout', LAYOUTS)
  if (layout) style.layout = layout
  const icon = oneOf<IconName>('icon', ICON_NAMES)
  if (icon) style.icon = icon
  const color = oneOf<Fill>('color', FILLS)
  if (color) style.color = color
  const fill = oneOf<Fill>('fill', FILLS)
  if (fill) style.fill = fill
  return style
}

function parseCell(raw: unknown, where: string): Cell {
  if (raw === null || raw === undefined) return { type: 'text', text: '' }
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return { type: 'text', text: String(raw) }
  }
  if (!isObj(raw)) throw new FormatError(`${where} must be a value or a mapping`)

  // A cell is a widget (one widget key; `check` also takes `text`) or plain text (a `text` key).
  const widgets = WIDGET_KEYS.filter((t) => t in raw)
  const textOk = widgets.length === 0 || TEXT_WIDGETS.includes(widgets[0])
  const stray = 'text' in raw && !textOk
  if (widgets.length > 1 || stray || (widgets.length === 0 && !('text' in raw))) {
    throw new FormatError(`${where} must have exactly one of text, ${WIDGET_KEYS.join(', ')}`)
  }

  const style = parseStyle(raw, where)
  const base = {
    ...(Object.keys(style).length ? { style } : {}),
    ...(raw.span !== undefined && Number(raw.span) > 1 ? { span: Number(raw.span) } : {}),
  }
  const label = raw.label !== undefined ? { label: String(raw.label) } : {}
  const num = (v: unknown, key: string) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new FormatError(`${where}.${key} must be a number`)
    return v
  }

  switch (widgets[0]) {
    case undefined:
      return { type: 'text', text: String(raw.text ?? ''), ...base }
    case 'counter':
      return {
        type: 'counter',
        value: num(raw.counter, 'counter'),
        step: raw.step === undefined ? 1 : num(raw.step, 'step'),
        ...label,
        ...(raw.goal !== undefined ? { goal: num(raw.goal, 'goal') } : {}),
        ...base,
      }
    case 'timer':
      return {
        type: 'timer',
        ms: num(raw.timer, 'timer'),
        since: raw.since === undefined ? null : num(raw.since, 'since'),
        ...(raw.from !== undefined ? { from: num(raw.from, 'from') } : {}),
        ...label,
        ...base,
      }
    case 'check':
      if (typeof raw.check !== 'boolean') throw new FormatError(`${where}.check must be true or false`)
      return { type: 'check', checked: raw.check, text: String(raw.text ?? ''), ...(raw.shape === 'square' ? { shape: 'square' as const } : {}), ...base }
    case 'rating': {
      const max = raw.max === undefined ? 5 : num(raw.max, 'max')
      const value = num(raw.rating, 'rating')
      if (!Number.isInteger(max) || max < 1 || max > 10) throw new FormatError(`${where}.max must be a whole number from 1 to 10`)
      if (!Number.isInteger(value) || value < 0 || value > max) throw new FormatError(`${where}.rating must be a whole number from 0 to ${max}`)
      if (raw.symbol !== undefined && !ICON_NAMES.includes(raw.symbol as IconName)) throw new FormatError(`${where}.symbol must be one of ${ICON_NAMES.join(', ')}`)
      return { type: 'rating', value, max, ...(raw.symbol !== undefined ? { symbol: raw.symbol as IconName } : {}), ...label, ...base }
    }
    case 'progress': {
      const value = num(raw.progress, 'progress')
      if (value < 0 || value > 100) throw new FormatError(`${where}.progress must be from 0 to 100`)
      if (raw.shape !== undefined && raw.shape !== 'ring' && raw.shape !== 'bar') throw new FormatError(`${where}.shape must be bar or ring`)
      return { type: 'progress', value, ...(raw.shape === 'ring' ? { shape: 'ring' as const } : {}), ...label, ...base }
    }
    case 'toggle':
      if (typeof raw.toggle !== 'boolean') throw new FormatError(`${where}.toggle must be true or false`)
      return { type: 'toggle', on: raw.toggle, text: String(raw.text ?? ''), ...base }
    case 'number': {
      const v = raw.number
      if (v !== null && v !== '' && (typeof v !== 'number' || !Number.isFinite(v))) throw new FormatError(`${where}.number must be a number or empty`)
      return {
        type: 'number',
        value: typeof v === 'number' ? v : null,
        ...(raw.prefix !== undefined ? { prefix: String(raw.prefix) } : {}),
        ...(raw.unit !== undefined ? { unit: String(raw.unit) } : {}),
        ...label,
        ...base,
      }
    }
    case 'mood': {
      const value = num(raw.mood, 'mood')
      if (!Number.isInteger(value) || value < 0 || value > 5) throw new FormatError(`${where}.mood must be a whole number from 0 to 5`)
      return { type: 'mood', value, ...label, ...base }
    }
    case 'habit': {
      const d = raw.habit
      if (!Array.isArray(d) || d.length !== 7) throw new FormatError(`${where}.habit must be a list of 7 days (1 or 0)`)
      return { type: 'habit', days: d.map((x) => x === true || x === 1), ...(raw.shape === 'square' ? { shape: 'square' as const } : {}), ...label, ...base }
    }
    case 'pips': {
      const max = raw.max === undefined ? 5 : num(raw.max, 'max')
      const value = num(raw.pips, 'pips')
      if (!Number.isInteger(max) || max < 2 || max > 12) throw new FormatError(`${where}.max must be a whole number from 2 to 12`)
      if (!Number.isInteger(value) || value < 0 || value > max) throw new FormatError(`${where}.pips must be a whole number from 0 to ${max}`)
      return { type: 'pips', value, max, ...label, ...base }
    }
    case 'time': {
      const value = raw.time === null || raw.time === undefined || raw.time === '' ? '' : String(raw.time)
      const m = /^(\d{1,2}):(\d{2})$/.exec(value)
      if (value && (!m || Number(m[1]) > 23 || Number(m[2]) > 59)) throw new FormatError(`${where}.time must look like 09:15`)
      return { type: 'time', value: m ? `${m[1].padStart(2, '0')}:${m[2]}` : '', ...label, ...base }
    }
    case 'link':
      return { type: 'link', url: String(raw.link ?? ''), text: String(raw.text ?? ''), ...base }
    case 'badge': {
      if (!ICON_NAMES.includes(raw.badge as IconName)) throw new FormatError(`${where}.badge must be one of ${ICON_NAMES.join(', ')}`)
      return { type: 'badge', icon: raw.badge as IconName, ...label, ...base }
    }
    case 'bars': {
      const max = raw.max === undefined ? 10 : num(raw.max, 'max')
      const v = raw.bars
      if (max <= 0) throw new FormatError(`${where}.max must be above 0`)
      if (!Array.isArray(v) || v.length < 2 || v.length > 14 || v.some((x) => typeof x !== 'number' || x < 0 || x > max)) {
        throw new FormatError(`${where}.bars must be 2 to 14 numbers from 0 to ${max}`)
      }
      if (raw.axis !== undefined && raw.axis !== 'week') throw new FormatError(`${where}.axis must be week`)
      if (raw.axis === 'week' && v.length !== 7) throw new FormatError(`${where}.bars needs 7 values for a week chart`)
      return { type: 'bars', values: v as number[], max, ...(raw.axis === 'week' ? { axis: 'week' as const } : {}), ...label, ...base }
    }
    case 'countdown': {
      const value = raw.countdown === null || raw.countdown === undefined || raw.countdown === '' ? '' : String(raw.countdown)
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FormatError(`${where}.countdown must look like 2026-12-25`)
      return { type: 'countdown', value, ...label, ...base }
    }
    case 'tag': {
      const options = raw.options === undefined ? DEFAULT_TAG_OPTIONS : raw.options
      if (!Array.isArray(options) || options.length === 0) throw new FormatError(`${where}.options must be a non-empty list`)
      return { type: 'tag', value: String(raw.tag ?? options[0]), options: options.map(String), ...base }
    }
    case 'date': {
      const value = raw.date === null || raw.date === undefined || raw.date === '' ? '' : String(raw.date)
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FormatError(`${where}.date must look like 2026-10-23`)
      return { type: 'date', value, ...label, ...base }
    }
  }
}

// Plain text cells with no styling collapse to a bare string; everything else is
// a small mapping keyed by its type.
function encodeCell(cell: Cell): unknown {
  const extras: Obj = {}
  const s = cell.style
  if (s?.bold) extras.bold = true
  if (s?.italic) extras.italic = true
  if (s?.underline) extras.underline = true
  if (s?.strike) extras.strike = true
  if (s?.align && s.align !== 'left') extras.align = s.align
  if (s?.size) extras.size = s.size
  if (s?.font) extras.font = s.font
  if (s?.border) extras.border = s.border
  if (s?.layout) extras.layout = s.layout
  if (s?.icon) extras.icon = s.icon
  if (s?.color) extras.color = s.color
  if (s?.fill) extras.fill = s.fill
  if (cell.span && cell.span > 1) extras.span = cell.span
  const label = 'label' in cell && cell.label ? { label: cell.label } : {}
  switch (cell.type) {
    case 'text':
      return Object.keys(extras).length ? { text: cell.text, ...extras } : cell.text
    case 'counter':
      return {
        counter: cell.value,
        ...(cell.step !== 1 ? { step: cell.step } : {}),
        ...label,
        ...(cell.goal !== undefined ? { goal: cell.goal } : {}),
        ...extras,
      }
    case 'timer':
      return { timer: cell.ms, ...(cell.since !== null ? { since: cell.since } : {}), ...(cell.from !== undefined ? { from: cell.from } : {}), ...label, ...extras }
    case 'check':
      return { check: cell.checked, ...(cell.text ? { text: cell.text } : {}), ...(cell.shape ? { shape: cell.shape } : {}), ...extras }
    case 'rating':
      return { rating: cell.value, ...(cell.max !== 5 ? { max: cell.max } : {}), ...(cell.symbol ? { symbol: cell.symbol } : {}), ...label, ...extras }
    case 'progress':
      return { progress: cell.value, ...(cell.shape ? { shape: cell.shape } : {}), ...label, ...extras }
    case 'toggle':
      return { toggle: cell.on, ...(cell.text ? { text: cell.text } : {}), ...extras }
    case 'number':
      return { number: cell.value, ...(cell.prefix ? { prefix: cell.prefix } : {}), ...(cell.unit ? { unit: cell.unit } : {}), ...label, ...extras }
    case 'mood':
      return { mood: cell.value, ...label, ...extras }
    case 'habit':
      return { habit: cell.days.map((d) => (d ? 1 : 0)), ...(cell.shape ? { shape: cell.shape } : {}), ...label, ...extras }
    case 'pips':
      return { pips: cell.value, ...(cell.max !== 5 ? { max: cell.max } : {}), ...label, ...extras }
    case 'time':
      return { time: cell.value, ...label, ...extras }
    case 'link':
      return { link: cell.url, ...(cell.text ? { text: cell.text } : {}), ...extras }
    case 'badge':
      return { badge: cell.icon, ...label, ...extras }
    case 'bars':
      return { bars: cell.values, ...(cell.max !== 10 ? { max: cell.max } : {}), ...(cell.axis ? { axis: cell.axis } : {}), ...label, ...extras }
    case 'countdown':
      return { countdown: cell.value, ...label, ...extras }
    case 'tag': {
      const custom = cell.options.join('\u0000') !== DEFAULT_TAG_OPTIONS.join('\u0000')
      return { tag: cell.value, ...(custom ? { options: cell.options } : {}), ...extras }
    }
    case 'date':
      return { date: cell.value, ...label, ...extras }
  }
}

export function serializeNote(note: Note): string {
  const doc = new Document()
  // Short lists and cells are written in flow style so a row is one line of text.
  const flowNode = (v: unknown) => {
    const node = doc.createNode(v)
    if (isCollection(node)) node.flow = true
    return node
  }
  const looseObj = (p: Placed) => {
    const encoded = encodeCell(p.cell)
    return flowNode({ at: flowNode([p.x, p.y]), ...(typeof encoded === 'string' ? { text: encoded } : (encoded as Obj)) })
  }
  doc.contents = doc.createNode({
    version: FORMAT_VERSION,
    title: note.title,
    ...(note.flow !== 'down' ? { flow: note.flow } : {}),
    columns: flowNode(note.columns),
    ...(note.cells.length ? { cells: note.cells.map(looseObj) } : {}),
    ...(note.groups.length
      ? {
          groups: note.groups.map((g) => ({
            at: flowNode([g.x, g.y]),
            variant: g.variant,
            ...(g.fill ? { fill: g.fill } : {}),
            rows: g.rows.map((r) => flowNode(r.map((c) => flowNode(encodeCell(c))))),
          })),
        }
      : {}),
  })
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false })
}
