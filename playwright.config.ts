import { defineConfig, devices } from '@playwright/test'

// The tests serve the production build (dist/) in-process (see e2e/serve.ts), so
// there is no dev server and no network. `npm run test:e2e` builds first.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    // Optional: run against an already-installed Chromium instead of Playwright's download.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    // Mobile is the primary target, so it comes first.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /wide\.spec/ },
    // A narrow desktop window: still the phone layout (dock and sheets), with a mouse.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 800 } }, testIgnore: /wide\.spec/ },
    // iPad landscape / desktop: the inspector layout.
    { name: 'wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, testMatch: /wide\.spec/ },
  ],
})
