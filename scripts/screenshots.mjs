// Takes the screenshots in the README, as if the app were being used on an 11-inch iPad, with the example notes
// loaded as a library. Needs a production build first:  npm run build && npm run screenshots
// Set PW_CHROMIUM to use a Chromium that is already installed.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { chromium } from '@playwright/test'

const ORIGIN = 'http://app.test'
const DIST = join(process.cwd(), 'dist')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
// The same order the dev library uses (src/devseed.ts), newest first.
const ORDER = ['leg-day', 'widgets', 'more', 'habits', 'looks', 'golf-yardages', 'gifts', 'grocery', 'lisbon-trip', 'empty']

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No build found. Run `npm run build` first.')
  process.exit(1)
}

const examples = readdirSync('examples').filter((f) => f.endsWith('.yaml')).map((f) => f.replace('.yaml', ''))
const names = [...ORDER.filter((n) => examples.includes(n)), ...examples.filter((n) => !ORDER.includes(n)).sort()]
const now = Date.now()
const notes = names.map((name, i) => {
  const source = readFileSync(`examples/${name}.yaml`, 'utf8')
  return { id: `ex-${name}`, title: /^title: (.*)$/m.exec(source)?.[1] ?? name, updated: now - (i + 1) * 47 * 60_000, source }
})

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined })
mkdirSync('docs/screenshots', { recursive: true })

// An 11-inch iPad is 834 x 1194 points, with two pixels to a point.
async function shoot(file, viewport, go, height = viewport.height) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, colorScheme: 'light' })
  const page = await context.newPage()
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    const file = join(DIST, path === '/' || !extname(path) ? 'index.html' : path)
    if (!file.startsWith(DIST) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) })
  })
  // The app moves notes it finds in localStorage into its own database on first load.
  await page.addInitScript((seed) => {
    localStorage.setItem('euclidnote:index', JSON.stringify(seed.map(({ id, title, updated }) => ({ id, title, updated }))))
    for (const n of seed) localStorage.setItem(`euclidnote:note:${n.id}`, n.source)
  }, notes)
  await go(page)
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `docs/screenshots/${file}`, clip: { x: 0, y: 0, width: viewport.width, height } })
  console.log(`docs/screenshots/${file}`)
  await context.close()
}

const open = async (page, id) => {
  await page.goto(`${ORIGIN}/#/ex-${id}`)
  await page.getByTestId('grid').waitFor()
}

// Landscape: the list beside the note.
await shoot('ipad-landscape.png', { width: 1194, height: 834 }, (page) => open(page, 'widgets'))

// Landscape, editing: a cell selected, with the inspector open.
await shoot('ipad-editing.png', { width: 1194, height: 834 }, async (page) => {
  await open(page, 'leg-day')
  await page.getByTestId('mode-toggle').click()
  await page.getByTestId('cell-0-1').click()
})

// Portrait: the page of notes.
await shoot('ipad-notes.png', { width: 834, height: 1194 }, async (page) => {
  await page.goto(`${ORIGIN}/`)
  await page.getByTestId('home-title').waitFor()
}, 740) // the page is short; leave out the empty space below

await browser.close()
