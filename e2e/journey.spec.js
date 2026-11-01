import { PASSWORD, PROTECTED, clickNav, expect, test, uniqueEmail } from './fixtures.js'

test('full journey: sign up → build a workout → train → dashboard updates → logout', async ({ page }, testInfo) => {
  const email = uniqueEmail(testInfo.project.name)
  const mobile = testInfo.project.name.includes('mobile')

  await test.step('sign up from the landing page and land on the Dashboard', async () => {
    await page.goto('/')
    await page.getByRole('button', { name: /Start Your Workout/ }).first().click()
    await page.getByLabel('Name').fill('Jordan Tester')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/#\/dashboard$/)
    await expect(page.getByRole('heading', { name: /Jordan/ })).toBeVisible()
    await expect(page.getByText('No workout yet today.')).toBeVisible()
    // Name + logout are in the navbar
    await expect(page.getByRole('button', { name: 'Log out' }).filter({ visible: true })).toBeVisible()
    if (!mobile) await expect(page.getByRole('complementary')).toContainText('Jordan Tester')
  })

  await test.step('add 2 exercises from the Workout Library', async () => {
    await page.getByRole('button', { name: 'Open the Library' }).click()
    await expect(page.getByRole('heading', { name: 'Find your next move' })).toBeVisible()
    for (const name of ['Tempo Push-Up', 'Lat Pulldown']) {
      const card = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
      await card.getByRole('button', { name: /Add to today/ }).click()
      await expect(card.getByRole('button', { name: /In today/ })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: /Start workout · 2/ })).toBeVisible()
  })

  await test.step("Dashboard shows today's workout; click Start", async () => {
    await clickNav(page, mobile ? 'Home' : 'Dashboard')
    await expect(page.getByRole('heading', { name: 'Back & Chest' })).toBeVisible()
    await expect(page.getByText('Tempo Push-Up · 3×')).toBeVisible()
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page).toHaveURL(/#\/live$/)
  })

  await test.step('Live Workout: rest timer counts down from the exercise rest time', async () => {
    await expect(page.getByRole('timer')).toHaveText('GO')
    await page.locator('button[aria-pressed="false"]').first().click()
    const timer = page.getByRole('timer')
    await expect(timer).toHaveText(/^0[01]:\d\d$/) // Tempo Push-Up rests 60s
    const toSeconds = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
    const first = toSeconds(await timer.textContent())
    expect(first).toBeGreaterThan(55)
    expect(first).toBeLessThanOrEqual(60)
    await page.waitForTimeout(2200)
    const later = toSeconds(await timer.textContent())
    expect(later).toBeLessThan(first)
    expect(later).toBeGreaterThanOrEqual(first - 4)
  })

  await test.step('tick every set, finish, and see confetti', async () => {
    for (let i = 0; i < 20; i++) {
      if (await page.getByText('Workout crushed').isVisible()) break
      const next = page.locator('button[aria-pressed="false"]').first()
      if (await next.isVisible()) {
        await next.click()
      } else {
        // current exercise is done; expand the next one if it didn't auto-open
        const collapsed = page.locator('button[aria-expanded="false"]').filter({ hasNotText: '3/3' }).first()
        if (await collapsed.isVisible()) await collapsed.click()
        else await page.waitForTimeout(300)
      }
      const skip = page.getByRole('button', { name: 'Skip rest' })
      if (await skip.isEnabled()) await skip.click()
    }
    await expect(page.getByRole('dialog')).toContainText('Workout crushed!')
    // canvas-confetti draws on a <canvas> it adds to the page
    await expect.poll(() => page.locator('canvas').count()).toBeGreaterThan(0)
    await expect(page.getByRole('dialog')).toContainText('6Sets')
  })

  let dashboard
  await test.step('Dashboard updates: streak, chart and rings show the new workout', async () => {
    await page.getByRole('dialog').getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.getByText('Completed today')).toBeVisible()
    dashboard = await (await page.request.get('/api/dashboard')).json()
    expect(dashboard.streak.current).toBe(1)
    expect(dashboard.week.workouts).toBe(1)
    expect(dashboard.activity.at(-1).minutes).toBeGreaterThanOrEqual(1)

    await expect(page.getByText('day in a row')).toBeVisible() // singular = streak of 1
    await expect(page.getByText('Finish a workout and your bars start growing')).toHaveCount(0) // chart is no longer empty
    const pct = Math.round(((1 / 4 + Math.min(1, dashboard.week.minutes / 150)) / 2) * 100)
    await expect(page.getByText(`${pct}%`, { exact: true })).toBeVisible()
    await expect(page.getByText('3 more workouts to hit')).toBeVisible()
    if (!mobile) await expect(page.getByRole('complementary')).toContainText('1 day')
  })

  await test.step('refresh the page: data is still there', async () => {
    await page.reload()
    await expect(page.getByText('Completed today')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Back & Chest' })).toBeVisible()
    await expect(page.getByText('day in a row')).toBeVisible()
  })

  await test.step('logout, then protected pages redirect to login', async () => {
    await page.getByRole('button', { name: 'Log out' }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/#\/home$/)
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    for (const p of PROTECTED) {
      await page.goto(`/#/${p}`)
      await expect(page).toHaveURL(/#\/login$/)
      await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    }
  })

  await test.step('log back in: the redirect returns you to the page you wanted', async () => {
    await page.goto('/#/library')
    await expect(page).toHaveURL(/#\/login$/)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/#\/library$/)
  })
})
