import { type Locator, type Page, test as base, expect } from '@playwright/test'
import { ORIGIN, serveDist } from './serve'

export { expect }
export type { Page }
export const test = base.extend({
  page: async ({ page }, use) => {
    await serveDist(page)
    await use(page)
  },
})

// Open the app, optionally seeded with a note in the text format (how we author
// examples). The seed applies once, so reloads keep the user's edits.
export async function open(page: Page, note?: string) {
  // Notes live in a library; a seeded note becomes its only entry, and the page opens straight onto it.
  await page.addInitScript((t) => {
    // Seed once per browser context. The app moves these into its database on load, so they are not here after that.
    if (t && !localStorage.getItem('__seeded')) {
      localStorage.setItem('__seeded', '1')
      localStorage.setItem('euclidnote:note:n1', t)
      localStorage.setItem('euclidnote:index', JSON.stringify([{ id: 'n1', title: 'Seeded', updated: Date.now() }]))
    }
  }, note ?? STARTER)
  await page.goto(`${ORIGIN}/#/n1`)
  await page.getByTestId('grid').waitFor()
}

export const edit = (page: Page) => page.getByTestId('mode-toggle').click()
export const tid = (page: Page, id: string) => page.getByTestId(id)

export const center = async (l: Locator) => {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

// Press on one element and release over another, moving in steps like a finger.
export async function dragTo(page: Page, from: Locator, to: Locator | { x: number; y: number }) {
  const a = await center(from)
  const b = 'x' in to ? to : await center(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 10 })
  await page.mouse.up()
}

export const noPageOverflow = async (page: Page) => {
  const o = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - window.innerWidth,
    y: document.documentElement.scrollHeight - window.innerHeight,
  }))
  expect(o.x).toBeLessThanOrEqual(0)
  expect(o.y).toBeLessThanOrEqual(0)
}

export const scrollMetrics = (page: Page) =>
  page.getByTestId('scroll').evaluate((el) => ({
    sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight, sl: el.scrollLeft, st: el.scrollTop,
  }))

export const STARTER = `title: Leg day
columns: [2fr, 1fr, 1fr]
cells:
  - {at: [0, 0], span: 3, text: Leg day, bold: true}
groups:
  - at: [0, 1]
    variant: stack
    rows:
      - [{text: Squat, bold: true}, {counter: 0, label: Reps}, {timer: 0}]
      - [{text: Lunge, bold: true}, {counter: 0, label: Reps}, {timer: 0}]
`

// Wait for entrance/selection animations to finish so measurements are stable.
export const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
