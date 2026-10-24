// Serves the production build (dist/) to a page by intercepting requests for a fake
// origin, so the tests need no dev server and no network.
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import type { Page } from '@playwright/test'

export const ORIGIN = 'http://app.test'
const DIST = join(process.cwd(), 'dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
}

export async function serveDist(page: Page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname
    // Like a dev server, unknown paths without an extension (e.g. /demo) get the app.
    const file = normalize(join(DIST, path === '/' || !extname(path) ? 'index.html' : path))
    if (!file.startsWith(DIST) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({
      status: 200,
      contentType: TYPES[extname(file)] ?? 'application/octet-stream',
      body: readFileSync(file),
    })
  })
}
