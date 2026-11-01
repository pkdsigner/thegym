import { expect, signUpViaApi, test } from './fixtures.js'

const GROUPS = ['Chest', 'Back', 'Legs', 'Arms', 'Core', 'Cardio']

test.describe('Workout Library filters', () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page, 'library')
    await page.goto('/#/library')
    await expect(page.locator('article')).toHaveCount(30)
  })

  test('"All" shows all 30 exercises', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('article')).toHaveCount(30)
  })

  for (const group of GROUPS) {
    test(`${group} filter shows only the 5 ${group} cards`, async ({ page }) => {
      await page.getByRole('tab', { name: new RegExp(`^${group}`) }).click()
      await expect(page.getByRole('tab', { name: new RegExp(`^${group}`) })).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('article')).toHaveCount(5)
      const labels = await page.locator('article p.label').allTextContents()
      expect(labels).toEqual(Array(5).fill(group))
    })
  }

  test('search with no matches shows a friendly empty state', async ({ page }) => {
    await page.getByLabel('Search exercises').fill('underwater basket weaving')
    await expect(page.getByText('No moves match that')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.locator('article')).toHaveCount(30)
  })
})
