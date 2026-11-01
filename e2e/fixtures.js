import { test as base, expect } from '@playwright/test'

export { expect }

export const PASSWORD = 'Test1234!'
export const uniqueEmail = (tag) => `e2e+${tag}-${Date.now()}${Math.random().toString(36).slice(2, 7)}@pulsefit.test`

/**
 * Every test automatically fails if the browser logs any console error or warning,
 * or throws an uncaught exception.
 */
export const test = base.extend({
  consoleIssues: [
    async ({ page }, use) => {
      const issues = []
      page.on('console', (msg) => {
        // ERR_NETWORK_CHANGED is Windows briefly resetting the network adapter mid-download, not the app
        if (/net::ERR_NETWORK_CHANGED/.test(msg.text())) return
        if (msg.type() === 'error' || msg.type() === 'warning') issues.push(`[${msg.type()}] ${msg.text()}`)
      })
      page.on('pageerror', (err) => issues.push(`[uncaught] ${err.message}`))
      await use(issues)
      expect(issues, `Browser console problems:\n${issues.join('\n')}`).toEqual([])
    },
    { auto: true },
  ],
})

/** Creates a user through the API; the browser context shares the login cookie. */
export async function signUpViaApi(page, tag = 'user') {
  const email = uniqueEmail(tag)
  const res = await page.request.post('/api/auth/signup', {
    data: { fullName: 'E2E Tester', email, password: PASSWORD, weeklyGoalWorkouts: 4, weeklyGoalMinutes: 150 },
  })
  expect(res.status()).toBe(201)
  return email
}

/** Clicks whichever copy of a nav item is visible (sidebar on desktop, bottom bar on mobile). */
export async function clickNav(page, name) {
  await page.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click()
}

export const PAGES = ['home', 'login', 'signup', 'dashboard', 'library', 'live', 'progress', 'classes', 'profile']
export const PROTECTED = ['dashboard', 'library', 'live', 'profile']
