// The document model. The whole note is one grid: loose cells and groups of cells,
// placed by position, never overlapping. `flow` only decides which axis scrolls and
// which is divided to fit the screen.

export type Align = 'left' | 'center' | 'right'

export const SIZES = ['small', 'large', 'title'] as const
export type Size = (typeof SIZES)[number]

// Tints are semantic (they adapt to light/dark), not free colors. Used for cell fills,
// text colors and group tints.
export const FILLS = [
  'red', 'orange', 'yellow', 'lime', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'sand', 'gray', 'ink',
] as const
export type Fill = (typeof FILLS)[number]

// Sans is the default and is not stored.
export const FONTS = ['serif', 'mono', 'rounded', 'display'] as const
export type Font = (typeof FONTS)[number]

export const BORDERS = ['thin', 'thick', 'dashed'] as const
export type Border = (typeof BORDERS)[number]
// How a widget arranges itself in its cell. Unset means automatic: centered on a tile, a caption column in a wide list row, otherwise caption on top.
export const LAYOUTS = ['center', 'start', 'row'] as const
export type Layout = (typeof LAYOUTS)[number]

export const ICON_NAMES = [
  'star', 'heart', 'flag', 'bolt', 'check', 'clock', 'calendar', 'pin', 'cart', 'gift',
  'dumbbell', 'fire', 'drop', 'sun', 'moon', 'note', 'dollar', 'plane', 'bed', 'fork',
  'home', 'car', 'bike', 'run', 'book', 'music', 'camera', 'phone', 'mail', 'coffee',
  'leaf', 'paw', 'umbrella', 'cloud', 'bell', 'lock', 'key', 'trophy', 'target', 'rocket',
  'bulb', 'tool', 'brush', 'pill', 'briefcase', 'bag', 'map', 'globe', 'wifi', 'film',
  'headphones', 'user', 'users', 'ticket', 'anchor', 'mountain',
] as const
export type IconName = (typeof ICON_NAMES)[number]

export interface CellStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  align?: Align
  size?: Size
  font?: Font
  border?: Border
  layout?: Layout
  icon?: IconName
  color?: Fill
  fill?: Fill
}

interface CellBase {
  style?: CellStyle
  // Number of columns this cell covers (default 1).
  span?: number
}

export interface TextCell extends CellBase {
  type: 'text'
  text: string
}

export interface CounterCell extends CellBase {
  type: 'counter'
  value: number
  step: number
  label?: string
  // Optional target: shown as "3 / 10" and celebrated when reached.
  goal?: number
}

export interface TimerCell extends CellBase {
  type: 'timer'
  // Counts down from this many ms instead of up, and finishes at zero.
  from?: number
  // Elapsed ms banked while paused.
  ms: number
  // Epoch ms when the timer was last started, or null when paused. Elapsed time
  // is ms + (now - since), so it stays right across reloads and backgrounded tabs.
  since: number | null
  label?: string
}

export interface CheckCell extends CellBase {
  type: 'check'
  shape?: 'square'
  checked: boolean
  text: string
}

export interface RatingCell extends CellBase {
  type: 'rating'
  // What the rating is made of (a star unless set).
  symbol?: IconName
  value: number
  max: number
  label?: string
}

export interface ProgressCell extends CellBase {
  type: 'progress'
  // 0 to 100.
  value: number
  label?: string
  // A bar (default) or a ring.
  shape?: 'ring'
}

export interface ToggleCell extends CellBase {
  type: 'toggle'
  on: boolean
  text: string
}

export interface NumberCell extends CellBase {
  type: 'number'
  prefix?: string
  // null until something is typed.
  value: number | null
  unit?: string
  label?: string
}

// How the day felt, from 1 (rough) to 5 (great); 0 is not set.
export interface MoodCell extends CellBase {
  type: 'mood'
  value: number
  label?: string
}

// Seven days, Monday first: did you do it?
export interface HabitCell extends CellBase {
  type: 'habit'
  shape?: 'square'
  days: boolean[]
  label?: string
}

// Days until (or since) a date.
export interface CountdownCell extends CellBase {
  type: 'countdown'
  // YYYY-MM-DD, or '' when not set.
  value: string
  label?: string
}

export const DEFAULT_TAG_OPTIONS = ['To do', 'Doing', 'Done']

export interface TagCell extends CellBase {
  type: 'tag'
  value: string
  // Tapping cycles through these; each gets its own color by position.
  options: string[]
}

export interface DateCell extends CellBase {
  type: 'date'
  // YYYY-MM-DD, or '' when not set.
  value: string
  label?: string
}

// A row of dots filled up to a count: sets done, steps taken.
export interface PipsCell extends CellBase {
  type: 'pips'
  value: number
  max: number
  label?: string
}

// A time of day, HH:MM (24 hour), or '' when not set.
export interface TimeCell extends CellBase {
  type: 'time'
  value: string
  label?: string
}

export interface LinkCell extends CellBase {
  type: 'link'
  url: string
  // What the link says; the site name when empty.
  text: string
}

// A big icon, as a visual anchor. Tint it with the cell's text color.
export interface BadgeCell extends CellBase {
  type: 'badge'
  icon: IconName
  label?: string
}

// A little bar chart whose bars you set by dragging.
export interface BarsCell extends CellBase {
  type: 'bars'
  values: number[]
  max: number
  // 'week' is a seven-bar chart labelled with the days; without it the chart is custom: any count, no labels.
  axis?: 'week'
  label?: string
}

export type Cell =
  | TextCell | CheckCell | ToggleCell | LinkCell | CounterCell | NumberCell | TimerCell | RatingCell | MoodCell
  | ProgressCell | HabitCell | PipsCell | BarsCell | TagCell | DateCell | CountdownCell | TimeCell | BadgeCell
export type CellType = Cell['type']
export const CELL_TYPES: CellType[] = [
  'text', 'check', 'toggle', 'link', 'badge', 'counter', 'number', 'timer', 'rating', 'mood', 'progress', 'pips',
  'habit', 'bars', 'tag', 'date', 'time', 'countdown',
]

// How a group presents its cells. Prefab looks, not themes.
//   plain    nothing drawn
//   card     one card around the whole group
//   table    one card, hairlines between rows and columns
//   header   one card, the top row set off as a header
//   sidebar  one card, the first column set off as labels
//   stripe   one card with a colored bar down the left
//   stack    a separate card for each row
//   tiles    each cell its own tile
//   outline  an outline around the group
export const VARIANTS = ['plain', 'card', 'table', 'header', 'sidebar', 'stripe', 'stack', 'tiles', 'outline'] as const
export type Variant = (typeof VARIANTS)[number]
// Names from earlier versions of the format.
export const VARIANT_ALIASES: Record<string, Variant> = { grid: 'table', cards: 'stack', list: 'table', banded: 'header' }

// A cell sitting on its own on the note's grid (a heading, a lone widget).
export interface Placed {
  x: number
  y: number
  cell: Cell
}

// A rectangle of cells that share a look and can be duplicated or resized as one.
// `rows` is dense: every row covers the same number of columns. A group's position
// is `x, y`; its size is derived from its rows.
export interface Group {
  x: number
  y: number
  variant: Variant
  // An optional tint for the group's surface.
  fill?: Fill
  rows: Cell[][]
}

// How the note scrolls. Cell positions are identical in both; only the scroll
// behaviour differs, and the axis that does not scroll is divided to fit the screen.
//   down:  scrolls vertically. Columns share the screen width (at most MAX_FIT);
//          rows are unbounded.
//   right: scrolls horizontally. Rows share the screen height (at most MAX_FIT);
//          columns are unbounded, each as wide as a row is tall (times its weight).
export const FLOWS = ['down', 'right'] as const
export type Flow = (typeof FLOWS)[number]

export interface Note {
  title: string
  flow: Flow
  // Column widths: "1fr", "2.5fr", or "auto". Always at least as long as the
  // content is wide. In a `down` note they share the screen width.
  columns: string[]
  cells: Placed[]
  groups: Group[]
}

export type CellRef =
  | { in: 'loose'; i: number }
  | { in: 'group'; g: number; r: number; c: number }

export type Selection = { kind: 'cell'; ref: CellRef } | { kind: 'group'; g: number }

// Cells are big and roughly square, so this is not a dense-table tool. The fitted
// axis defaults to 2 cells and content scales down to fit up to MAX_FIT.
export const DEFAULT_FIT = 2
export const MAX_FIT = 5
