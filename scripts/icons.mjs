// Draws the app icon and writes it to public/ as SVG and PNG. Run `npm run icons` after changing the design.
// The PNGs are rendered with Playwright's Chromium (set PW_CHROMIUM to use one that is already installed).
//
// The mark is a block "E" built the way the app builds things: a tall yellow spine and three arms, each a cell
// in one of the app's colors, on charcoal. The middle arm is shorter, as in a real E. It sits inside the middle
// ~62% of the canvas, so the same artwork survives the circular and squircle masks that phones apply.
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const INK = '#25252b'
const BLOBS = [
  { x: 192, y: 192, w: 192, h: 640, fill: '#f4cf5a' }, // the spine: yellow
  { x: 416, y: 192, w: 416, h: 192, fill: '#7b80f5' }, // top arm: indigo
  { x: 416, y: 416, w: 320, h: 192, fill: '#f7a3c6' }, // middle arm: pink, shorter
  { x: 416, y: 640, w: 416, h: 192, fill: '#cde66d' }, // bottom arm: lime
]
const mark = BLOBS.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="64" fill="${b.fill}"/>`).join('')
// rounded: the icon on its own, with transparent corners. flush: edge to edge, for masks and the home screen.
const svg = (rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="${rounded ? 224 : 0}" fill="${INK}"/>${mark}</svg>\n`

mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.svg', svg(true))

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined })
const page = await browser.newPage()
async function png(name, size, rounded) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(rounded)}`)
  await page.screenshot({ path: `public/${name}`, omitBackground: true })
  console.log(`public/${name}`)
}
await png('icon-192.png', 192, true)
await png('icon-512.png', 512, true)
await png('icon-maskable-512.png', 512, false)
await png('icon-180.png', 180, false) // the home screen icon on iPhone and iPad (linked with rel="apple-touch-icon")
await png('favicon-32.png', 32, true)
await browser.close()
