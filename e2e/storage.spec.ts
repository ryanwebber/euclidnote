import { ORIGIN } from './serve'
import { expect, open, test, tid } from './fixtures'

type P = import('@playwright/test').Page
// Everything in the app's database, as a plain object.
const database = (page: P) =>
  page.evaluate(
    () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const r = indexedDB.open('euclidnote')
        r.onerror = () => reject(r.error)
        r.onsuccess = () => {
          const store = r.result.transaction('kv').objectStore('kv')
          const keys = store.getAllKeys()
          keys.onsuccess = () => {
            const values = store.getAll()
            values.onsuccess = () => resolve(Object.fromEntries(keys.result.map((k, i) => [String(k), String(values.result[i])])))
          }
        }
      }),
  )
const noteKeysInLocalStorage = (page: P) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('euclidnote:note') || k === 'euclidnote:index'))

test.describe('storage', () => {
  test('notes live in the database, not in localStorage', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await expect(tid(page, 'home-title')).toBeVisible()
    const db = await database(page)
    expect(Object.keys(db).some((k) => k.startsWith('euclidnote:note:'))).toBe(true)
    expect(JSON.parse(db['euclidnote:index'])).toHaveLength(1)
    expect(await noteKeysInLocalStorage(page)).toEqual([])
  })

  test('saved notes carry their format version', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-open-"]').first().click()
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.waitForTimeout(400)
    const db = await database(page)
    const key = Object.keys(db).find((k) => k.startsWith('euclidnote:note:'))!
    expect(db[key].startsWith('version: 1\n')).toBe(true)
    expect(db[key]).toContain('counter: 1')
  })

  test('edits survive a reload', async ({ page }) => {
    await open(page)
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.waitForTimeout(400)
    await page.reload()
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
  })

  test('notes an older version kept in localStorage move into the database', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('__seeded')) return
      localStorage.setItem('__seeded', '1')
      localStorage.setItem('euclidnote:index', JSON.stringify([{ id: 'old1', title: 'Camping', updated: 5 }]))
      localStorage.setItem('euclidnote:note:old1', 'title: Camping\ncolumns: [1fr, 1fr]\n')
      localStorage.setItem('euclidnote:settings', '{"theme":"dark","haptics":false}')
    })
    await page.goto(`${ORIGIN}/`)
    await expect(page.locator('.note-title')).toHaveText(['Camping'])
    const db = await database(page)
    expect(db['euclidnote:note:old1']).toContain('Camping')
    expect(await noteKeysInLocalStorage(page)).toEqual([])
    // preferences are not notes: they stay where they were
    expect(await page.evaluate(() => localStorage.getItem('euclidnote:settings'))).toContain('dark')
    // and a note opened from there is the same note
    await page.locator('[data-testid^="note-open-"]').first().click()
    await expect(tid(page, 'title')).toHaveText('Camping')
  })

  test('a save the database never finished is recovered on the next launch', async ({ page }) => {
    await open(page)
    await expect(tid(page, 'title')).toHaveText('Leg day')
    // as if the page was closed after noting the write but before the database had it
    await page.evaluate(() => localStorage.setItem('euclidnote:journal:euclidnote:note:n1', 'version: 1\ntitle: Recovered\ncolumns: [1fr]\n'))
    await page.reload()
    await expect(tid(page, 'title')).toHaveText('Recovered')
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('euclidnote:journal:')))).toEqual([])
    expect((await database(page))['euclidnote:note:n1']).toContain('Recovered')
  })

  test('a stale copy left in localStorage never replaces the database', async ({ page }) => {
    await open(page)
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      localStorage.setItem('euclidnote:note:n1', 'title: Stale copy\ncolumns: [1fr]\n')
    })
    await page.reload()
    await expect(tid(page, 'title')).toHaveText('Leg day')
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
    expect(await noteKeysInLocalStorage(page)).toEqual([])
  })

  test('a note from a newer version is kept untouched, with a warning, and can still be deleted', async ({ page }) => {
    const future = 'version: 99\ntitle: From the future\ncolumns: [1fr]\nwidgets: {warp: 9}\n'
    await page.addInitScript((src) => {
      if (localStorage.getItem('__seeded')) return
      localStorage.setItem('__seeded', '1')
      localStorage.setItem('euclidnote:index', JSON.stringify([{ id: 'fut', title: 'From the future', updated: 5 }]))
      localStorage.setItem('euclidnote:note:fut', src)
    }, future)
    await page.goto(`${ORIGIN}/#/fut`)
    await expect(tid(page, 'problem')).toContainText('newer version')
    await expect(tid(page, 'problem')).toContainText('nothing you do on this page is saved')
    // editing does not write over it
    await tid(page, 'mode-toggle').click()
    await tid(page, 'title-input').fill('Overwritten?')
    await page.waitForTimeout(500)
    expect((await database(page))['euclidnote:note:fut']).toBe(future)
    await page.reload()
    await expect(tid(page, 'problem')).toBeVisible()
    expect((await database(page))['euclidnote:note:fut']).toBe(future)
    // the list still shows it, and it can be deleted
    await page.goto(`${ORIGIN}/#/`)
    await expect(page.locator('.note-title')).toHaveText(['From the future'])
    await page.locator('[data-testid^="note-menu-"]').first().click()
    await page.locator('[data-testid^="note-delete-"]').click()
    await tid(page, 'delete-confirm').click()
    await expect(page.locator('[data-testid^="note-card-"]')).toHaveCount(0)
  })

  test('without IndexedDB it falls back to localStorage and keeps working', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }))
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-open-"]').first().click()
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.waitForTimeout(400)
    expect((await noteKeysInLocalStorage(page)).length).toBeGreaterThan(0)
    await page.reload() // the address still names the note
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
    await tid(page, 'back').click()
    await tid(page, 'settings-open').click()
    await expect(tid(page, 'settings')).toContainText('in browser storage')
  })

  test('development seeding is not part of the production build', async ({ page }) => {
    await page.goto(`${ORIGIN}/?seed=reset`)
    await expect(page.getByTestId('home-title')).toBeVisible()
    await expect(page.locator('[data-testid^="note-card-"]')).toHaveCount(1) // the starter, not the examples
    expect(page.url()).toContain('seed=reset') // nothing acted on it, so nothing tidied it away
    await page.goto(`${ORIGIN}/?seed=clear`)
    await expect(page.locator('[data-testid^="note-card-"]')).toHaveCount(1) // and nothing was cleared
    const files = await page.evaluate(() => [...document.querySelectorAll('script[src]')].map((s) => (s as HTMLScriptElement).src))
    for (const src of files) {
      const text = await page.evaluate(async (u) => (await fetch(u)).text(), src)
      expect(text).not.toContain('seed=')
      expect(text).not.toContain('ex-leg-day')
    }
  })

  test('the settings sheet says where notes are kept', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await tid(page, 'settings-open').click()
    await expect(tid(page, 'settings')).toContainText('in the database')
  })
})
