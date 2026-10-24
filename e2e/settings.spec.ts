import { readFileSync } from 'node:fs'
import { ORIGIN } from './serve'
import { expect, settled, test, tid } from './fixtures'

const cards = (page: import('@playwright/test').Page) => page.locator('[data-testid^="note-card-"]')
const bg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await tid(page, 'settings-open').click()
    await expect(tid(page, 'settings')).toBeVisible()
  })

  test('opens from the list and closes with the button, Escape or a tap outside', async ({ page }) => {
    await tid(page, 'settings-close').click()
    await expect(tid(page, 'settings')).toHaveCount(0)
    await tid(page, 'settings-open').click()
    await page.keyboard.press('Escape')
    await expect(tid(page, 'settings')).toHaveCount(0)
    await tid(page, 'settings-open').click()
    await tid(page, 'settings-scrim').click({ position: { x: 5, y: 5 } })
    await expect(tid(page, 'settings')).toHaveCount(0)
  })

  test('fits the screen and scrolls inside itself', async ({ page }) => {
    await settled(page)
    const box = (await tid(page, 'settings').boundingBox())!
    const vp = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  })

  test('appearance: light and dark override the device, and the choice is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await tid(page, 'theme-system').click()
    expect(await bg(page)).toBe('rgb(18, 18, 21)')
    await tid(page, 'theme-light').click()
    expect(await bg(page)).toBe('rgb(236, 231, 218)')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    expect(await bg(page)).toBe('rgb(236, 231, 218)')
    await tid(page, 'settings-open').click()
    await expect(tid(page, 'theme-light')).toHaveAttribute('aria-pressed', 'true')
    await tid(page, 'theme-dark').click()
    expect(await bg(page)).toBe('rgb(18, 18, 21)')
    await page.emulateMedia({ colorScheme: 'light' })
    expect(await bg(page)).toBe('rgb(18, 18, 21)') // still dark: it is forced
    await tid(page, 'theme-system').click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    expect(await bg(page)).toBe('rgb(236, 231, 218)')
  })

  test('the browser bar color follows a forced theme', async ({ page }) => {
    await tid(page, 'theme-dark').click()
    const colors = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')))
    expect(colors).toEqual(['#121215', '#121215'])
    await tid(page, 'theme-system').click()
    const back = await page.locator('meta[name="theme-color"]').evaluateAll((els) => els.map((e) => e.getAttribute('content')))
    expect(back).toEqual(['#ece7da', '#121215'])
  })

  test('haptics can be turned off, and stay off', async ({ page }) => {
    await expect(tid(page, 'haptics-on')).toHaveAttribute('aria-pressed', 'true')
    await tid(page, 'haptics-off').click()
    await page.reload()
    await tid(page, 'settings-open').click()
    await expect(tid(page, 'haptics-off')).toHaveAttribute('aria-pressed', 'true')
  })

  test('shows what is stored, the version, and that offline needs a secure connection here', async ({ page }) => {
    await expect(tid(page, 'settings')).toContainText('1 note')
    await expect(tid(page, 'settings')).toContainText(/v\d+\.\d+\.\d+ · built \d{4}-\d{2}-\d{2}/)
    await expect(tid(page, 'offline')).toHaveAttribute('data-state', 'unavailable')
  })

  test('export saves every note to one file', async ({ page }) => {
    const download = page.waitForEvent('download')
    await tid(page, 'export').click()
    const d = await download
    expect(d.suggestedFilename()).toMatch(/^euclidnote-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const file = JSON.parse(readFileSync((await d.path())!, 'utf8'))
    expect(file).toMatchObject({ app: 'euclidnote', version: 1 })
    expect(file.notes).toHaveLength(1)
    expect(file.notes[0]).toMatchObject({ title: 'Leg day' })
    expect(file.notes[0].source).toContain('Squat')
    await expect(tid(page, 'settings-message')).toHaveText('Backup saved.')
  })

  test('import adds the notes from a backup, skipping any that cannot be read', async ({ page }) => {
    const backup = JSON.stringify({
      app: 'euclidnote',
      version: 1,
      notes: [{ title: 'Camping', updated: 1, source: 'title: Camping\ncolumns: [1fr, 1fr]\n' }, { title: 'Broken', updated: 2, source: 'columns: [oops' }],
    })
    await tid(page, 'import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) })
    await expect(tid(page, 'settings-message')).toHaveText('Added 1 note, skipped 1 that could not be read.')
    await tid(page, 'settings-close').click()
    await expect(cards(page)).toHaveCount(2)
    await expect(page.locator('.note-title')).toContainText(['Camping'])
  })

  test('import explains when a file is not a backup, and changes nothing', async ({ page }) => {
    await tid(page, 'import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
    await expect(tid(page, 'settings-message')).toHaveText('That file is not an Euclidnote backup.')
    await tid(page, 'settings-close').click()
    await expect(cards(page)).toHaveCount(1)
  })

  test('a backup restores into a fresh library', async ({ page }) => {
    const download = page.waitForEvent('download')
    await tid(page, 'export').click()
    const file = readFileSync((await (await download).path())!)
    await tid(page, 'wipe').click()
    await tid(page, 'wipe-confirm').click()
    await expect(tid(page, 'empty-new')).toBeVisible()
    await tid(page, 'settings-open').click()
    await tid(page, 'import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: file })
    await expect(tid(page, 'settings-message')).toContainText('Added 1 note')
    await tid(page, 'settings-close').click()
    await expect(page.locator('.note-title')).toHaveText(['Leg day'])
  })

  test('delete all asks first, then removes every note and leaves a button to start again', async ({ page }) => {
    await tid(page, 'wipe').click()
    await expect(tid(page, 'wipe-dialog')).toContainText('Delete all 1 notes?')
    await tid(page, 'wipe-cancel').click()
    await expect(tid(page, 'wipe-dialog')).toHaveCount(0)
    await expect(tid(page, 'settings')).toBeVisible()
    await tid(page, 'wipe').click()
    await tid(page, 'wipe-confirm').click()
    await expect(tid(page, 'settings')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(0)
    await expect(tid(page, 'empty-new')).toBeVisible()
    await page.reload()
    await expect(tid(page, 'empty-new')).toBeVisible() // stays empty
  })
})
