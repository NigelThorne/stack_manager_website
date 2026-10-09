import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5198',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm preview:cloudflare',
    url: 'http://127.0.0.1:5198',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
