import type { ReactNode } from 'react'
import type { IconName } from '../model/types'

// A small stroke icon set. All 24x24, 1.8 stroke, round caps, currentColor.
const icon = (children: ReactNode) =>
  function Icon({ size = 22 }: { size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    )
  }

export const UndoIcon = icon(<><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>)
export const RedoIcon = icon(<><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>)
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />)
export const TrashIcon = icon(<><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>)
export const TextIcon = icon(<><path d="M4 18 9 6l5 12" /><path d="M5.8 14h6.4" /><path d="M16 18l2.5-6 2.5 6" /><path d="M16.9 16h3.2" /></>)
export const FillIcon = icon(<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z" />)
export const WidgetIcon = icon(<><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 12h6" /></>)
export const LookIcon = icon(<><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>)
export const UngroupIcon = icon(<><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /><path d="M14 6h6M6 14v6" strokeDasharray="1 3" /></>)
export const LayoutIcon = icon(<><path d="M12 3v7M9 7l3 3 3-3" /><path d="M21 12h-7M17 9l-3 3 3 3" /><rect x="3" y="14" width="8" height="7" rx="2" /></>)
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const AlignLeftIcon = icon(<path d="M4 6h16M4 10h10M4 14h16M4 18h10" />)
export const AlignCenterIcon = icon(<path d="M4 6h16M7 10h10M4 14h16M7 18h10" />)
export const AlignRightIcon = icon(<path d="M4 6h16M10 10h10M4 14h16M10 18h10" />)
export const PlayIcon = icon(<path d="M8 5.5v13l11-6.5Z" fill="currentColor" />)
export const PauseIcon = icon(<><path d="M8 5.5v13" strokeWidth="3.2" /><path d="M16 5.5v13" strokeWidth="3.2" /></>)
export const ResetIcon = icon(<><path d="M4 4v6h6" /><path d="M5.5 15a8 8 0 1 0 1-7.5L4 10" /></>)
export const MinusIcon = icon(<path d="M5 12h14" strokeWidth="2.4" />)
export const PlusBoldIcon = icon(<path d="M12 5v14M5 12h14" strokeWidth="2.4" />)
export const GripIcon = icon(<><circle cx="9" cy="8" r="1.2" fill="currentColor" /><circle cx="15" cy="8" r="1.2" fill="currentColor" /><circle cx="9" cy="12" r="1.2" fill="currentColor" /><circle cx="15" cy="12" r="1.2" fill="currentColor" /><circle cx="9" cy="16" r="1.2" fill="currentColor" /><circle cx="15" cy="16" r="1.2" fill="currentColor" /></>)

// ---- widget and tool icons ----
export const HeadingIcon = icon(<><path d="M6 5v14M18 5v14M6 12h12" /></>)
export const CheckboxIcon = icon(<><rect x="4" y="4" width="16" height="16" rx="5" /><path d="m8.5 12.3 2.4 2.4 4.6-5" /></>)
export const CounterIcon = icon(<><rect x="3.5" y="6" width="17" height="12" rx="6" /><path d="M8 12h3M9.5 10.5v3M14 12h2.5" /></>)
export const TimerIcon = icon(<><circle cx="12" cy="13.5" r="7" /><path d="M12 10v3.8l2.4 1.4M9.5 3h5" /></>)
export const ProgressIcon = icon(<><rect x="3" y="9.5" width="18" height="5" rx="2.5" /><rect x="3" y="9.5" width="9" height="5" rx="2.5" fill="currentColor" /></>)
export const TagIcon = icon(<><path d="M3.5 12.5v-7a2 2 0 0 1 2-2h7l8 8-9 9z" /><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" /></>)
export const DuplicateIcon = icon(<><rect x="8" y="8" width="12" height="12" rx="3.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>)
export const RowAddIcon = icon(<><rect x="3.5" y="4" width="17" height="6" rx="2" /><path d="M12 14.5v6M9 17.5h6" /></>)
export const XIcon = icon(<path d="M6 6l12 12M18 6 6 18" />)

// Icons a cell can wear (`icon:` in the format).
const symbol = (children: ReactNode) => icon(children)
const SYMBOLS: Record<IconName, ReturnType<typeof icon>> = {
  star: symbol(<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />),
  heart: symbol(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />),
  flag: symbol(<path d="M6 21V4M6 5h11l-2 4 2 4H6" />),
  bolt: symbol(<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />),
  check: symbol(<path d="m5 12.5 4.5 4.5L19 7.5" />),
  clock: symbol(<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  calendar: symbol(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M8 3v4M16 3v4" /></>),
  pin: symbol(<><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>),
  cart: symbol(<><path d="M3 4h2.5l2 11h10l2-8H7" /><circle cx="9.5" cy="19" r="1.2" /><circle cx="16.5" cy="19" r="1.2" /></>),
  gift: symbol(<><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M3 7h18v3H3zM12 7v13M12 7C9.5 7 8 4 10 3.5c1.5-.3 2 2 2 3.5zM12 7c2.5 0 4-3 2-3.5-1.5-.3-2 2-2 3.5z" /></>),
  dumbbell: symbol(<path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11" />),
  fire: symbol(<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2 0 2 1 2.7 1.5 2.7C10 9 11 6 12 3z" />),
  drop: symbol(<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z" />),
  sun: symbol(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8" /></>),
  moon: symbol(<path d="M20 14.5A8 8 0 0 1 9.500 4a8 8 0 1 0 10.5 10.5z" />),
  note: symbol(<><rect x="5" y="3" width="14" height="18" rx="3" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  dollar: symbol(<path d="M12 3v18M16 7.5C16 5.800 14.200 5 12 5S8 6 8 7.800c0 4 8 2 8 6.2 0 1.8-1.8 2.800-4 2.800s-4-.9-4-2.7" />),
  plane: symbol(<path d="M21.5 3 2.5 10.5l7 3 3 7zM9.500 13.5l5-5" />),
  bed: symbol(<><path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11" r="1.8" /></>),
  fork: symbol(<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M17 21V3c-2.5 1-4 4-4 8h4" />),
  home: symbol(<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>),
  car: symbol(<><path d="M5 16v-4l1.6-4.2a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3L19 12v4" /><path d="M4 16h16v3H4z" /><path d="M7.5 13.5h.01M16.5 13.5h.01" /></>),
  bike: symbol(<><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="m6 16 3.5-7h5L18 16M9.5 9 12 16h4M8 6.5h3" /></>),
  run: symbol(<><circle cx="14.5" cy="5" r="1.8" /><path d="m12.5 9.5-2.5 2.5 3 2.5 1 5M10 12l-3-.5M13 14.5 10.5 18M14.5 10l3 1.5" /></>),
  book: symbol(<><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></>),
  music: symbol(<><path d="M9 17V6l10-2v11" /><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="15.5" r="2.5" /></>),
  camera: symbol(<><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8.5 7 10 4.5h4L15.5 7" /><circle cx="12" cy="13.5" r="3.2" /></>),
  phone: symbol(<path d="M7 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 5 5.5a2 2 0 0 1 2-2z" />),
  mail: symbol(<><rect x="3" y="5.5" width="18" height="13" rx="3" /><path d="m4 8 8 6 8-6" /></>),
  coffee: symbol(<><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3.5c0 1.5 1.5 1.5 1.5 3M12 3.5c0 1.5 1.5 1.5 1.5 3" /></>),
  leaf: symbol(<><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z" /><path d="M5 19c3-5 6-8 10-10" /></>),
  paw: symbol(<><circle cx="8" cy="9" r="1.6" /><circle cx="12" cy="6.8" r="1.6" /><circle cx="16" cy="9" r="1.6" /><path d="M12 11c3 0 5.5 3 5.5 5.3 0 2-2 2.7-3.5 2.2-1-.4-1.3-.5-2-.5s-1 .1-2 .5C8.5 19 6.5 18.3 6.5 16.3 6.5 14 9 11 12 11z" /></>),
  umbrella: symbol(<><path d="M3.5 12a8.5 8.5 0 0 1 17 0z" /><path d="M12 12v6a2 2 0 0 0 4 0" /></>),
  cloud: symbol(<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17 18z" />),
  bell: symbol(<><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  lock: symbol(<><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  key: symbol(<><circle cx="8" cy="14" r="3.8" /><path d="m11 12 9-8M16 8l2.5 2.5M13.5 10.5l2 2" /></>),
  trophy: symbol(<><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4" /></>),
  target: symbol(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>),
  rocket: symbol(<><path d="M12 3c3.3 2.4 4.7 6 4.2 10.2L12 17l-4.2-3.8C7.3 9 8.7 5.4 12 3z" /><circle cx="12" cy="9.5" r="1.5" /><path d="M7.8 13.2 5 15.5l.7 3.2 3.3-1.7M16.2 13.2l2.8 2.3-.7 3.2-3.3-1.7M10.5 19.5c.4 1 .9 1.5 1.5 1.5s1.1-.5 1.5-1.5" /></>),
  bulb: symbol(<><path d="M9 17h6M10 20h4" /><path d="M12 3.5a6 6 0 0 0-3.5 10.8c.7.6 1 1.4 1 2.2h5c0-.8.3-1.6 1-2.2A6 6 0 0 0 12 3.5z" /></>),
  tool: symbol(<><path d="m13 8 4 4M15 5.5l3.5 3.5-2 2L13 7.5z" /><path d="m13 9-8 8a1.5 1.5 0 0 0 3 3l8-8" /></>),
  brush: symbol(<><path d="M18.5 4.5 10 13" /><path d="M8.5 14.5C6 14.5 5 16 5 18a3 3 0 0 0 3 2c2.5 0 4-1.5 4-3.5z" /><path d="m18.5 4.5 1 1" /></>),
  pill: symbol(<><rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" /><path d="m9.5 9.5 5 5" /></>),
  briefcase: symbol(<><rect x="3.5" y="7.5" width="17" height="12" rx="3" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17" /></>),
  bag: symbol(<><path d="M5.5 8h13l1 12h-15z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></>),
  map: symbol(<path d="M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7zM9 5v12M15 7v12" />),
  globe: symbol(<><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5C9.5 18 8.5 15 8.5 12S9.5 6 12 3.5z" /></>),
  wifi: symbol(<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.5 16a4 4 0 0 1 5 0M12 19.5h.01" />),
  film: symbol(<><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M8 5v14M16 5v14M3.5 10H8M3.5 14H8M16 10h4.5M16 14h4.5" /></>),
  headphones: symbol(<path d="M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5zM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z" />),
  user: symbol(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
  users: symbol(<><circle cx="9" cy="9" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M15 6.3a3 3 0 0 1 0 5.4M17 14a5 5 0 0 1 3.5 5" /></>),
  ticket: symbol(<path d="M4 7h16v3.5a2 2 0 0 0 0 4V18H4v-3.5a2 2 0 0 0 0-4zM14 7v2M14 11v2M14 15v3" />),
  anchor: symbol(<><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5V20M7.5 11.5h9M5 14c0 4 3 6 7 6s7-2 7-6" /></>),
  mountain: symbol(<path d="M3 19 9.5 8l4 7 2-3L21 19zM9.5 8l1.8 3.2" />),
}
export function NamedIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const Glyph = SYMBOLS[name]
  return <Glyph size={size} />
}

// ---- round 3 widget icons ----
export const ToggleIcon = icon(<><rect x="2.5" y="7" width="19" height="10" rx="5" /><circle cx="16.5" cy="12" r="2.6" fill="currentColor" /></>)
export const NumberIcon = icon(<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h16M3.5 15h16" />)
export const MoodIcon = icon(<><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="10.2" r="0.9" fill="currentColor" /><circle cx="15" cy="10.2" r="0.9" fill="currentColor" /><path d="M8.5 14.5q3.5 3 7 0" /></>)
export const HabitIcon = icon(<><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="18.5" cy="12" r="2" fill="currentColor" /></>)
export const CountdownIcon = icon(<><path d="M7 3h10M7 21h10" /><path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" /></>)

// A face for each mood, 1 (rough) to 5 (great).
const MOUTHS = ['M8 16.5q4-4 8 0', 'M8.5 15.8q3.5-2 7 0', 'M8.5 15.5h7', 'M8.5 14.5q3.5 2.5 7 0', 'M7.5 14q4.5 5 9 0']
export function MoodFace({ level, size = 28 }: { level: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <path d={MOUTHS[Math.max(0, Math.min(4, level - 1))]} />
    </svg>
  )
}

// ---- round 4 widget icons ----
export const PipsIcon = icon(<><circle cx="5" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="19" cy="12" r="2" /></>)
export const LinkIcon = icon(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.8 6.5" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" /></>)
export const BadgeIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="m12 7.5 1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3L7.7 10.6l3-.4z" /></>)
export const BarsIcon = icon(<path d="M5 20v-7M10 20V6M15 20v-10M20 20V4" />)
export const TimeIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>)

export const MoreIcon = icon(<><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>)
export const BackIcon = icon(<path d="m15 5-7 7 7 7" />)
export const SidebarIcon = icon(<><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>)
export const GearIcon = icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)
