import { expect, test } from './fixtures.js'

test.describe('Landing page', () => {
  test('loads with PulseFit branding in the navbar, hero, footer and tab title', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/PulseFit/)
    await expect(page.getByRole('banner').getByRole('button', { name: 'PulseFit home' })).toContainText('PulseFit')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Train smarter.Get stronger.')
    await expect(page.locator('section').first()).toContainText('PulseFit')
    await expect(page.getByRole('contentinfo')).toContainText('PulseFit')
  })

  test('counters animate up to the real numbers from the database', async ({ page }) => {
    const stats = await (await page.request.get('/api/stats')).json()
    expect(stats.classesThisWeek).toBe(10)

    // Record every value the "Classes this week" counter shows, from the very first frame
    await page.addInitScript(() => {
      window.__counterValues = []
      const sample = () => {
        const box = [...document.querySelectorAll('dl > div')].find((d) => d.textContent.includes('Classes this week'))
        const text = box?.querySelector('dd')?.textContent ?? ''
        if (/\d/.test(text)) window.__counterValues.push(Number(text.replace(/\D/g, '')))
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.goto('/')
    const counter = page.locator('dl > div').filter({ hasText: 'Classes this week' }).locator('dd')
    await expect(counter).toHaveText('10')
    const seen = await page.evaluate(() => window.__counterValues)
    expect(seen.at(-1)).toBe(10)
    expect(seen.some((v) => v > 0 && v < 10), `values seen: ${[...new Set(seen)].join(',')}`).toBe(true)
    expect(seen).toEqual([...seen].sort((a, b) => a - b)) // only ever counts up
  })

  test('"Start Your Workout" goes to sign up when logged out', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Start Your Workout/ }).first().click()
    await expect(page).toHaveURL(/#\/signup$/)
    await expect(page.getByRole('heading', { name: /Start your streak/ })).toBeVisible()
  })
})
