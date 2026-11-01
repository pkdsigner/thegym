import { defineConfig, devices } from '@playwright/test'

// Browser tests run against their OWN servers on separate ports with a throwaway in-memory
// database, so they never touch your real data and don't clash with a running `npm run dev`.
const WEB_PORT = 5174
const API_PORT = 3101

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node server/dev.js',
      url: `http://localhost:${API_PORT}/api/stats`,
      env: { API_PORT: String(API_PORT), PULSEFIT_DB_DIR: 'memory', DATABASE_URL: '', JWT_SECRET: 'playwright-only-secret-7c1e' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
