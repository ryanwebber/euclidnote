import { STARTER, edit, expect, noPageOverflow, open, scrollMetrics, settled, test, tid } from './fixtures'

test.describe('view mode', () => {
  test('is calm: no editing chrome, no inputs', async ({ page }) => {
    await open(page, STARTER)
    await expect(page.locator('textarea, input')).toHaveCount(0)
    for (const id of ['selection', 'slot-0-3', 'sep-0', 'undo', 'group-grip-0']) {
      await expect(tid(page, id)).toHaveCount(0)
    }
    await expect(tid(page, 'mode-toggle')).toHaveText('Edit')
  })

  test('counters and timers work', async ({ page }) => {
    await page.clock.install()
    await open(page, STARTER)
    const counter = tid(page, 'cell-1-1')
    await counter.getByTestId('counter-inc').click()
    await counter.getByTestId('counter-inc').click()
    await counter.getByTestId('counter-dec').click()
    await expect(counter.getByTestId('counter-value')).toHaveText('1')
    const timer = tid(page, 'cell-2-1')
    await timer.getByTestId('timer-toggle').click()
    await page.clock.runFor(5000)
    await expect(timer.getByTestId('timer-value')).toHaveText('0:05')
    await timer.getByTestId('timer-toggle').click()
    await page.clock.runFor(5000)
    await expect(timer.getByTestId('timer-value')).toHaveText('0:05')
    await timer.getByTestId('timer-reset').click()
    await expect(timer.getByTestId('timer-value')).toHaveText('0:00')
  })

  test('using a widget is not an undo step', async ({ page }) => {
    await open(page, STARTER)
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await edit(page)
    await expect(tid(page, 'undo')).toBeDisabled()
  })

  test('widget state survives a reload', async ({ page }) => {
    await open(page, STARTER)
    await tid(page, 'cell-1-1').getByTestId('counter-inc').click()
    await page.reload()
    await expect(tid(page, 'cell-1-1').getByTestId('counter-value')).toHaveText('1')
  })

  test('fits the width and only scrolls vertically', async ({ page }) => {
    await open(page, STARTER)
    await noPageOverflow(page)
    const m = await scrollMetrics(page)
    expect(m.sw).toBeLessThanOrEqual(m.cw)
  })

  test('entering edit mode does not move the content', async ({ page }) => {
    await open(page, STARTER)
    await settled(page)
    const before = await tid(page, 'cell-0-1').boundingBox()
    await edit(page)
    await expect(tid(page, 'undo')).toBeVisible()
    await settled(page)
    const after = await tid(page, 'cell-0-1').boundingBox()
    expect(after).toEqual(before)
  })

  test('shows a hint for an empty note', async ({ page }) => {
    await open(page, 'title: Empty\ncolumns: [1fr, 1fr]\n')
    await expect(tid(page, 'empty-note')).toBeVisible()
    await edit(page)
    await expect(tid(page, 'empty-note')).toHaveCount(0)
    await expect(tid(page, 'slot-0-0')).toBeVisible()
  })

  test('follows the system dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await open(page, STARTER)
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(bg).toBe('rgb(18, 18, 21)')
    await page.emulateMedia({ colorScheme: 'light' })
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(236, 231, 218)')
  })

  test('on wide screens a down note is centered with a readable width', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop only')
    await open(page, STARTER)
    const box = (await tid(page, 'grid').boundingBox())!
    expect(box.width).toBeLessThanOrEqual(680)
    const left = box.x
    const right = page.viewportSize()!.width - (box.x + box.width)
    expect(Math.abs(left - right)).toBeLessThan(24)
  })

  test('text rows are compact and widget rows are full cells', async ({ page }) => {
    await open(page, STARTER)
    const heading = (await tid(page, 'cell-0-0').boundingBox())!
    const widgetRow = (await tid(page, 'cell-1-1').boundingBox())!
    expect(heading.height).toBeLessThan(widgetRow.height * 0.7)
  })
})
