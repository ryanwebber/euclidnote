import { ORIGIN } from './serve'
import { edit, expect, test, tid } from './fixtures'

const cards = (page: import('@playwright/test').Page) => page.locator('[data-testid^="note-card-"]')
const titles = (page: import('@playwright/test').Page) => page.locator('.note-title')

test.describe('the list of notes (phones and tablets)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'wide', 'wide screens use the sidebar')
  })

  test('first launch shows the list, with the starter note in it', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await expect(tid(page, 'home-title')).toHaveText('Notes')
    await expect(cards(page)).toHaveCount(1)
    await expect(titles(page)).toHaveText(['Leg day'])
    await expect(tid(page, 'grid')).toHaveCount(0)
  })

  test('opening a note and going back', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await cards(page).first().getByRole('button', { name: /Leg day|^Note options/ }).first().click()
    await expect(tid(page, 'grid')).toBeVisible()
    await expect(tid(page, 'title')).toHaveText('Leg day')
    await tid(page, 'back').click()
    await expect(tid(page, 'home-title')).toBeVisible()
  })

  test('the browser back button also returns to the list', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-open-"]').first().click()
    await expect(tid(page, 'grid')).toBeVisible()
    await page.goBack()
    await expect(tid(page, 'home-title')).toBeVisible()
  })

  test('New makes a blank note and opens it; edits show up in the list, newest first', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await tid(page, 'note-new').click()
    await expect(tid(page, 'grid')).toBeVisible()
    // a new note opens ready to fill in
    await expect(tid(page, 'mode-toggle')).toHaveText('Done')
    await expect(tid(page, 'title-input')).toHaveValue('Untitled')
    await tid(page, 'title-input').fill('Camping')
    await edit(page)
    await tid(page, 'back').click()
    await expect(cards(page)).toHaveCount(2)
    await expect(titles(page)).toHaveText(['Camping', 'Leg day'])
  })

  test('a note keeps its contents when you leave and come back', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-open-"]').first().click()
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await tid(page, 'back').click()
    await page.reload()
    await page.locator('[data-testid^="note-open-"]').first().click()
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
  })

  test('duplicate copies the note under a new name', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-menu-"]').first().click()
    await page.locator('[data-testid^="note-duplicate-"]').click()
    await expect(cards(page)).toHaveCount(2)
    await expect(titles(page)).toContainText(['Leg day copy'])
  })

  test('delete asks in a dialog; cancel keeps the note; with none left there is a button in the middle', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-menu-"]').first().click()
    await page.locator('[data-testid^="note-delete-"]').click()
    await expect(tid(page, 'delete-dialog')).toContainText('Delete “Leg day”?')
    await tid(page, 'delete-cancel').click()
    await expect(tid(page, 'delete-dialog')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(1)
    await page.locator('[data-testid^="note-menu-"]').first().click()
    await page.locator('[data-testid^="note-delete-"]').click()
    await tid(page, 'delete-confirm').click()
    await expect(cards(page)).toHaveCount(0)
    const btn = (await tid(page, 'empty-new').boundingBox())!
    const vp = page.viewportSize()!
    expect(Math.abs(btn.x + btn.width / 2 - vp.width / 2)).toBeLessThan(4)
    expect(btn.y).toBeGreaterThan(vp.height * 0.3)
    expect(btn.y).toBeLessThan(vp.height * 0.7)
    await tid(page, 'empty-new').click()
    await expect(tid(page, 'grid')).toBeVisible()
    await expect(tid(page, 'mode-toggle')).toHaveText('Done')
  })

  test('the menu closes on an outside tap', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await page.locator('[data-testid^="note-menu-"]').first().click()
    await expect(page.locator('.note-menu')).toBeVisible()
    await tid(page, 'home-title').click()
    await expect(page.locator('.note-menu')).toHaveCount(0)
  })

  test('a note saved by the single-note version is adopted', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('euclidnote:note', 'title: Old note\ncolumns: [1fr, 1fr]\n'))
    await page.goto(`${ORIGIN}/`)
    await expect(titles(page)).toHaveText(['Old note'])
    expect(await page.evaluate(() => localStorage.getItem('euclidnote:note'))).toBeNull()
  })

  test('the list fits the screen with no sideways scroll', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    for (let i = 0; i < 5; i++) {
      await tid(page, 'note-new').click()
      await tid(page, 'back').click()
    }
    const m = await tid(page, 'scroll').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }))
    expect(m.sw).toBeLessThanOrEqual(m.cw)
    await expect(cards(page)).toHaveCount(6)
  })
})

test.describe('the sidebar (big screens)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'wide', 'phones and tablets use the list page')
  })

  test('the list sits beside the note, and the first note opens on its own', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await expect(tid(page, 'sidebar')).toBeVisible()
    await expect(tid(page, 'grid')).toBeVisible()
    await expect(tid(page, 'back')).toHaveCount(0)
    await expect(titles(page)).toHaveText(['Leg day'])
  })

  test('new notes open, rows switch notes, and deleting the open one opens a neighbor', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await tid(page, 'note-new').click()
    await expect(tid(page, 'title-input')).toHaveValue('Untitled')
    await expect(cards(page)).toHaveCount(2)
    const leg = cards(page).filter({ hasText: 'Leg day' })
    await leg.locator('[data-testid^="note-open-"]').click()
    await expect(tid(page, 'title')).toHaveText('Leg day')
    await expect(leg).toHaveAttribute('data-active', 'true')
    await leg.locator('[data-testid^="note-menu-"]').click()
    await leg.locator('[data-testid^="note-delete-"]').click()
    await tid(page, 'delete-confirm').click()
    await expect(cards(page)).toHaveCount(1)
    await expect(tid(page, 'title')).toHaveText('Untitled')
  })

  test('the sidebar has its own shade and edge, and can be hidden and brought back', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    const bar = tid(page, 'sidebar')
    expect(await bar.evaluate((el) => getComputedStyle(el).borderRightWidth)).toBe('1px')
    expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    const before = (await tid(page, 'scroll').boundingBox())!
    await tid(page, 'sidebar-hide').click()
    await expect(bar).toHaveCount(0)
    const after = (await tid(page, 'scroll').boundingBox())!
    expect(after.x).toBeLessThan(before.x)
    await page.reload()
    await expect(bar).toHaveCount(0) // remembered
    await tid(page, 'sidebar-show').click()
    await expect(bar).toBeVisible()
    await expect(tid(page, 'sidebar-show')).toHaveCount(0)
  })

  test('with no notes open there is a button in the middle of the page', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await cards(page).first().locator('[data-testid^="note-menu-"]').click()
    await page.locator('[data-testid^="note-delete-"]').click()
    await tid(page, 'delete-confirm').click()
    await expect(cards(page)).toHaveCount(0)
    await expect(tid(page, 'empty-new')).toBeVisible()
    await tid(page, 'empty-new').click()
    await expect(tid(page, 'grid')).toBeVisible()
  })

  test('editing the title updates the sidebar', async ({ page }) => {
    await page.goto(`${ORIGIN}/`)
    await edit(page)
    await tid(page, 'title-input').fill('Renamed')
    await expect(titles(page)).toHaveText(['Renamed'])
  })
})
