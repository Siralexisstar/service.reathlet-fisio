import type { CSSProperties } from 'react'

const paths = {
  activity: ['M22 12h-3l-3 9L9 3l-3 9H2'],
  scan: ['M3 7V5a2 2 0 0 1 2-2h2', 'M17 3h2a2 2 0 0 1 2 2v2', 'M21 17v2a2 2 0 0 1-2 2h-2', 'M7 21H5a2 2 0 0 1-2-2v-2', 'M7 12h10'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', 'm8 13 2 2 4-4'],
  pin: ['M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  calendar: ['M8 2v4m8-4v4', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M3 10h18', 'M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01'],
  shield: ['M12 2c3 3 6 3 8 4v7c0 5-5 8-8 9-3-1-8-4-8-9V6c2-1 5-1 8-4Z', 'm9 12 2 2 4-4'],
  left: ['m15 18-6-6 6-6'],
  right: ['m9 18 6-6-6-6'],
  plus: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M8 12h8m-4-4v8'],
  waves: ['M2 5q2.5 2 5 0t5 0 5 0 5 0', 'M2 12q2.5 2 5 0t5 0 5 0 5 0', 'M2 19q2.5 2 5 0t5 0 5 0 5 0'],
  target: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'],
  syringe: ['m18 2 4 4m-5 1 3-3', 'M19 9 9 19a2.5 2.5 0 0 1-4-4L15 5', 'm9 11 4 4m-8 4-3 3m12-18 6 6'],
  hand: ['M11 14h2a2 2 0 0 0 0-4h-3l-7 6', 'm2 15 6 6 2-2h4c2 0 3-1 4-2l4-4a2 2 0 0 0-3-2l-4 3', 'M16 9s-5-3-5-5a3 3 0 0 1 5-2 3 3 0 0 1 5 2c0 2-5 5-5 5Z'],
  audio: ['M2 10v4m4-8v12m4-15v18m4-13v8m4-11v14m4-10v6'],
  clipboard: ['M9 2h6v4H9Z', 'M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3', 'm9 14 2 2 4-4'],
  check: ['M20 6 9 17l-5-5'],
  chat: ['M21 11.5a9 9 0 0 1-9 9c-1.7 0-3.2-.4-4.5-1.2L2 21l1.7-5.5A9 9 0 1 1 21 11.5Z'],
  clock: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 6v6h4'],
  menu: ['M4 5h16M4 12h16M4 19h16'],
  close: ['M18 6 6 18M6 6l12 12'],
  play: ['m6 3 14 9-14 9V3Z'],
  pause: ['M8 4v16M16 4v16'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm2 6 10 7L22 6'],
  lock: ['M7 10V7a5 5 0 0 1 10 0v3', 'M5 10h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z', 'M12 15v3'],
  copy: ['M9 9h12v12H9Z', 'M5 15H3V3h12v2'],
  up: ['m6 12 6-6 6 6M12 6v15'],
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 24, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name].map((d, i) => <path d={d} key={i} />)}</svg>
}
