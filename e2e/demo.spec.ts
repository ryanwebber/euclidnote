import { expect, open, test, tid } from './fixtures'
import { ORIGIN } from './serve'

test.describe('/demo route', () => {
  test('loads a sample note and lets you switch between samples', async ({ page }) => {
    await page.goto(`${ORIGIN}/demo`)
    await expect(tid(page, 'demo-bar')).toBeVisible()
    await expect(tid(page, 'title')).toHaveText('Leg day')
    await page.getByLabel('Sample note').selectOption('grocery')
    await expect(tid(page, 'title')).toHaveText('Groceries')
    await expect(page).toHaveURL(/note=grocery/)
  })

  test('each sample keeps its own edits, and Reset restores it', async ({ page }) => {
    await page.goto(`${ORIGIN}/demo?note=leg-day`)
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.reload()
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
    await tid(page, 'demo-bar').getByRole('button', { name: 'Reset' }).click()
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('0')
  })

  test('demo edits do not touch the real note', async ({ page }) => {
    await page.goto(`${ORIGIN}/demo?note=gifts`)
    await tid(page, 'mode-toggle').click()
    await tid(page, 'title-input').fill('Changed')
    await page.goto(`${ORIGIN}/`)
    await expect(page.locator('.note-title')).toHaveText('Leg day')
    await expect(tid(page, 'demo-bar')).toHaveCount(0)
  })

  test('every sample opens and renders', async ({ page }) => {
    for (const name of ['empty', 'gifts', 'golf-yardages', 'grocery', 'leg-day', 'lisbon-trip']) {
      await page.goto(`${ORIGIN}/demo?note=${name}`)
      await expect(tid(page, 'grid')).toBeVisible()
    }
  })
})

test.describe('header edit button', () => {
  test('is small and in the header; there is no big button at the bottom', async ({ page }) => {
    await open(page)
    const btn = (await tid(page, 'mode-toggle').boundingBox())!
    const vp = page.viewportSize()!
    expect(btn.height).toBeLessThanOrEqual(34)
    expect(btn.y).toBeLessThan(70)
    // top right of the header (which lines up with the content column on wide screens)
    const bar = (await tid(page, 'title').locator('xpath=..').boundingBox())!
    expect(btn.x + btn.width).toBeGreaterThan(bar.x + bar.width - 40)
    expect(vp.width).toBeGreaterThan(0)
    await expect(tid(page, 'dock')).toHaveCount(0)
  })

  test('becomes Done while editing, and the dock appears only then', async ({ page }) => {
    await open(page)
    await tid(page, 'mode-toggle').click()
    await expect(tid(page, 'mode-toggle')).toHaveText('Done')
    await expect(tid(page, 'dock')).toBeVisible()
    await tid(page, 'mode-toggle').click()
    await expect(tid(page, 'mode-toggle')).toHaveText('Edit')
    await expect(tid(page, 'dock')).toHaveCount(0)
  })
})
