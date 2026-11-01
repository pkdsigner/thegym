import AxeBuilder from '@axe-core/playwright'
import { PAGES, PROTECTED, expect, signUpViaApi, test } from './fixtures.js'

const settle = async (page) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800) // let entrance animations finish
}

async function visit(page, name) {
  await page.goto(`/#/${name}`)
  await expect(page).toHaveURL(new RegExp(`#/${name}$`))
  await settle(page)
}

test.describe('every page', () => {
  for (const name of PAGES) {
    test(`${name}: no console errors/warnings, accessible (axe WCAG 2.1 AA)`, async ({ page }) => {
      if (PROTECTED.includes(name) || ['progress', 'classes'].includes(name)) await signUpViaApi(page, `quality-${name}`)
      await visit(page, name)
      // Console problems are checked automatically by the fixture when the test ends.
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const summary = results.violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
            .slice(0, 3)
            .map((n) => `${n.target.join(' ')} → ${n.failureSummary?.split('\n').slice(1, 2).join(' ').trim()}`)
            .join('\n    ')}`,
      )
      expect(summary, summary.join('\n')).toEqual([])
    })
  }
})

test.describe('light mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pulsefit-theme', 'light'))
  })

  for (const name of ['home', 'login', 'signup', 'dashboard', 'library', 'live', 'progress', 'classes', 'profile']) {
    test(`${name}: accessible in light mode (axe WCAG 2.1 AA)`, async ({ page }) => {
      if (!['home', 'login', 'signup'].includes(name)) await signUpViaApi(page, `light-${name}`)
      await visit(page, name)
      await expect(page.locator('html')).not.toHaveClass(/dark/)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      const summary = results.violations.map(
        (v) =>
          `${v.id}: ${v.nodes
            .slice(0, 4)
            .map((n) => `${n.target.join(' ')} → ${n.failureSummary?.split('\n').slice(1, 2).join(' ').trim()}`)
            .join('\n    ')}`,
      )
      expect(summary, summary.join('\n')).toEqual([])
    })
  }
})

test.describe('375px mobile width', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('no page scrolls sideways', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', 'phone-width check runs on the mobile project')
    await signUpViaApi(page, 'narrow')
    const overflowing = []
    for (const name of PAGES) {
      // login/signup redirect to the dashboard when logged in; check them logged out at the end
      if (name === 'login' || name === 'signup') continue
      await visit(page, name)
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      if (scrollWidth > clientWidth) overflowing.push(`${name}: ${scrollWidth}px wide in a ${clientWidth}px screen`)
    }
    await page.getByRole('button', { name: 'Log out' }).filter({ visible: true }).click()
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    for (const name of ['login', 'signup']) {
      await visit(page, name)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      if (wide) overflowing.push(name)
    }
    expect(overflowing).toEqual([])
  })
})

test.describe('keyboard', () => {
  async function tabTo(page, matcher, max = 40) {
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab')
      const label = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body || el.tagName === 'MAIN') return '<page>'
        return (el.getAttribute('aria-label') || el.innerText || '').trim()
      })
      if (matcher.test(label)) return label
    }
    throw new Error(`Could not reach ${matcher} with the Tab key`)
  }

  const focusIsVisible = (page) =>
    page.evaluate(() => {
      const s = getComputedStyle(document.activeElement)
      return s.outlineStyle !== 'none' || s.boxShadow !== 'none'
    })

  test('sign up and reach the Library using only the keyboard', async ({ page }) => {
    await page.goto('/')
    await tabTo(page, /Start Your Workout/)
    expect(await focusIsVisible(page)).toBe(true)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/signup$/)

    await tabTo(page, /^$/) // first empty input (Name)
    await expect(page.getByLabel('Name')).toBeFocused()
    await page.keyboard.type('Kim Keys')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Email')).toBeFocused()
    await page.keyboard.type(`e2e+keys-${Date.now()}@pulsefit.test`)
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    await page.keyboard.type('Keys1234!')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/dashboard$/)

    await tabTo(page, /Open the Library/)
    expect(await focusIsVisible(page)).toBe(true)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#\/library$/)
    await expect(page.locator('article')).toHaveCount(30)

    // Focus moved to the new screen, so the very next Tabs land in the Library, not the footer
    await tabTo(page, /^Add to today’s workout$/, 15)
    expect(await focusIsVisible(page)).toBe(true)
    await page.keyboard.press('Enter')
    await expect(page.getByText('Added to today’s workout').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /In today’s workout/ })).toHaveCount(1)
  })

  test('every button and link has a readable name', async ({ page }) => {
    await signUpViaApi(page, 'names')
    const unnamed = []
    for (const name of ['home', 'dashboard', 'library', 'live', 'progress', 'classes', 'profile']) {
      await visit(page, name)
      const missing = await page.evaluate(() =>
        [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"]')]
          .filter((el) => !(el.getAttribute('aria-label') || el.innerText.trim() || el.getAttribute('title')))
          .map((el) => el.outerHTML.slice(0, 120)),
      )
      unnamed.push(...missing.map((m) => `${name}: ${m}`))
    }
    expect(unnamed).toEqual([])
  })
})
