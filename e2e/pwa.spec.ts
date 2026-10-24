import { ORIGIN } from './serve'
import { expect, test } from './fixtures'

test.describe('installable app', () => {
  test('the page points at a valid manifest and its icons', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('/manifest.webmanifest')
    const manifest = await page.evaluate(async (h) => (await fetch(h!)).json(), href)
    expect(manifest.name).toBe('Euclidnote')
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await page.evaluate(async (src) => (await fetch(src)).status, '/' + icon.src)
      expect(res, icon.src).toBe(200)
    }
  })

  test('the home screen icon loads at 180px', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const size = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const img = new Image()
          img.onload = () => resolve([img.naturalWidth, img.naturalHeight])
          img.src = (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement).href
        }),
    )
    expect(size).toEqual([180, 180])
  })

  test('the service worker script is served and handles fetches', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const sw = await page.evaluate(async () => (await fetch('/sw.js')).text())
    expect(sw).toContain("addEventListener('fetch'")
    expect(sw).toContain('caches.open')
  })

  test('the service worker stores every built file on the first visit, in a cache named for the build', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const sw = await page.evaluate(async () => (await fetch('/sw.js')).text())
    const built = await page.evaluate(() => [...document.querySelectorAll('script[src], link[rel="stylesheet"]')].map((e) => (e.getAttribute('src') ?? e.getAttribute('href'))!.replace(/^\//, '')))
    expect(built.length).toBeGreaterThan(1)
    for (const file of built) expect(sw, file).toContain(file)
    expect(sw).toMatch(/const CACHE = 'euclidnote-[0-9a-f]{10}'/)
    expect(sw).not.toContain('euclidnote-dev')
  })

  test('the browser tab and status bar colors follow the theme', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const metas = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => [e.getAttribute('content'), e.getAttribute('media')]))
    expect(metas).toEqual([
      ['#ece7da', '(prefers-color-scheme: light)'],
      ['#121215', '(prefers-color-scheme: dark)'],
    ])
  })
})
