import { PASSWORD, clickNav, expect, test, uniqueEmail } from './fixtures.js'

// Screen-by-screen checks: every screen loads, works, and has no console errors (checked by the fixture).

const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Sign up with easy goals and finish one workout through the API, so rings and chart have data. */
async function userWithFinishedWorkout(page) {
  const email = uniqueEmail('screens')
  let res = await page.request.post('/api/auth/signup', {
    data: { fullName: 'Riley Screens', email, password: PASSWORD, weeklyGoalWorkouts: 1, weeklyGoalMinutes: 15 },
  })
  expect(res.status()).toBe(201)
  const { exercises } = await (await page.request.get('/api/exercises?group=Core')).json()
  res = await page.request.post('/api/workouts/exercises', { data: { exerciseId: exercises[0].id, date: today() } })
  const { workout } = await res.json()
  for (const s of workout.exercises[0].sets) await page.request.patch('/api/sets', { data: { setId: s.id, completed: true } })
  await page.request.post('/api/workouts/finish', { data: { workoutId: workout.id } })
  return email
}

const SCREENS = {
  dashboard: { nav: { desktop: 'Dashboard', mobile: 'Home' }, heading: /Good (morning|afternoon|evening)/ },
  library: { nav: { desktop: 'Workouts', mobile: 'Library' }, heading: /Find your next move/ },
  live: { nav: { desktop: 'Live Workout', mobile: 'Live' }, heading: /Ready when you are|Workout|Day|&/ },
  progress: { nav: { desktop: 'Progress', mobile: 'Progress' }, heading: /Your strength story/ },
  classes: { nav: { desktop: 'Classes', mobile: 'Classes' }, heading: /This week at PulseFit/ },
  profile: { nav: { desktop: 'Profile', mobile: 'Profile' }, heading: /You, levelling up/ },
}

test.describe('Dashboard', () => {
  test('workout card, Start → Live, chart animates, streak, and all 3 rings fill', async ({ page }) => {
    await userWithFinishedWorkout(page)
    // Record the height of today's bar on every frame, from the first paint
    await page.addInitScript(() => {
      window.__barHeights = []
      const sample = () => {
        const bars = document.querySelectorAll('.recharts-bar-rectangle path')
        const last = bars[bars.length - 1]
        if (last) window.__barHeights.push(last.getBBox().height)
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.goto('/#/dashboard')
    await expect(page.getByText('Completed today')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Core Day' })).toBeVisible()

    // Chart animates: today's bar grows from (near) zero to its final height
    await page.waitForTimeout(1800)
    const heights = await page.evaluate(() => window.__barHeights)
    expect(heights.length).toBeGreaterThan(5)
    expect(heights.at(-1)).toBeGreaterThan(0)
    expect(heights[0]).toBeLessThan(heights.at(-1))

    // Streak shows
    await expect(page.getByText('day in a row')).toBeVisible()

    // 3 rings, each filled (dash offset smaller than the full circle)
    const rings = page.locator('main svg circle[stroke-linecap="round"]')
    await expect(rings).toHaveCount(3)
    const fills = await rings.evaluateAll((els) =>
      els.map((el) => 1 - parseFloat(getComputedStyle(el).strokeDashoffset) / parseFloat(el.getAttribute('stroke-dasharray'))),
    )
    for (const f of fills) {
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThanOrEqual(1)
    }

    // Quote of the day
    await expect(page.getByText('Quote of the day')).toBeVisible()
  })

  test('"Start" on today’s workout opens Live Workout mode', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Sam Start', email: uniqueEmail('start'), password: PASSWORD } })
    const { exercises } = await (await page.request.get('/api/exercises?group=Arms')).json()
    await page.request.post('/api/workouts/exercises', { data: { exerciseId: exercises[0].id, date: today() } })
    await page.goto('/#/dashboard')
    await page.getByRole('button', { name: /^Start/ }).click()
    await expect(page).toHaveURL(/#\/live$/)
    await expect(page.getByRole('timer')).toHaveText('GO')
  })
})

test.describe('Live Workout', () => {
  test('rest timer counts down in a circle', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Tia Timer', email: uniqueEmail('timer'), password: PASSWORD } })
    const { exercises } = await (await page.request.get('/api/exercises?group=Legs')).json()
    await page.request.post('/api/workouts/exercises', { data: { exerciseId: exercises[0].id, date: today() } })
    await page.goto('/#/live')
    await page.locator('button[aria-pressed="false"]').first().click()
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible()
    const ring = page.locator('main svg circle[stroke-linecap="round"]').first()
    const offset = () => ring.evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset))
    const before = await offset()
    await page.waitForTimeout(2000)
    const after = await offset()
    expect(after).toBeGreaterThan(before) // the coloured arc is shrinking
    // Pause stops the countdown
    await page.getByRole('button', { name: 'Pause timer' }).click()
    const paused = await page.getByRole('timer').textContent()
    await page.waitForTimeout(1500)
    await expect(page.getByRole('timer')).toHaveText(paused)
  })
})

test.describe('Progress', () => {
  test('line chart and PR cards with trophy badges', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Pat Progress', email: uniqueEmail('progress'), password: PASSWORD } })
    await page.goto('/#/progress')
    await expect(page.getByRole('heading', { name: 'Your strength story' })).toBeVisible()
    await expect(page.locator('.recharts-line')).toHaveCount(3)
    await expect(page.locator('.recharts-line-curve').first()).toHaveAttribute('d', /\S+/)
    await expect(page.getByRole('heading', { name: 'Personal records' })).toBeVisible()
    await expect(page.locator('main svg.lucide-trophy')).toHaveCount(6)
    await expect(page.getByText(/^(Gold|Silver|Bronze)$/)).toHaveCount(6)

    // Toggling every lift off shows a friendly empty state
    for (const lift of ['Deadlift', 'Squat', 'Bench']) await page.getByRole('button', { name: lift, exact: true }).click()
    await expect(page.getByText('Nothing to chart')).toBeVisible()
    await page.getByRole('button', { name: 'Show all lifts' }).click()
    await expect(page.locator('.recharts-line')).toHaveCount(3)
  })
})

test.describe('Class Booking', () => {
  test('Book lowers spots left and shows a toast; full classes cannot be booked', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Cass Classes', email: uniqueEmail('classes'), password: PASSWORD } })
    await page.goto('/#/classes')
    await expect(page.getByText('1 booked')).toBeVisible()

    await page.getByRole('button', { name: /^Sat/ }).click()
    const card = page.locator('article').filter({ hasText: 'Weekend Warrior' })
    await expect(card).toContainText('10 spots left')
    await card.getByRole('button', { name: 'Book' }).click()
    await expect(page.getByText('You’re in! 🎉')).toBeVisible()
    await expect(card).toContainText('9 spots left')
    await expect(card.getByRole('button', { name: 'Booked' })).toBeVisible()
    await expect(page.getByText('2 booked')).toBeVisible()

    // Cancelling gives the spot back
    await card.getByRole('button', { name: 'Booked' }).click()
    await expect(card).toContainText('10 spots left')
    await expect(page.getByText('1 booked')).toBeVisible()

    // A full class can only be wait-listed, never booked
    await page.getByRole('button', { name: /^Mon/ }).click()
    const full = page.locator('article').filter({ hasText: 'Fight Club Fundamentals' })
    await expect(full).toContainText('Full')
    await expect(full.getByRole('button', { name: 'Book', exact: true })).toHaveCount(0)
    await full.getByRole('button', { name: 'Join waitlist' }).click()
    await expect(page.getByText('This class is full')).toBeVisible()
    await expect(full.getByRole('button', { name: 'On waitlist' })).toBeVisible()
    await expect(page.getByText('1 booked')).toBeVisible()
  })

  test('empty states: a day with no classes, and a filter with no results', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Em Empty', email: uniqueEmail('empty'), password: PASSWORD } })
    await page.goto('/#/classes')
    await page.getByRole('button', { name: /^Sun/ }).click()
    await expect(page.getByText('Sunday is recovery day')).toBeVisible()
    await page.getByRole('button', { name: 'See Saturday' }).click()
    await expect(page.locator('article')).toHaveCount(2)
    await page.getByRole('button', { name: 'Boxing', exact: true }).click()
    await expect(page.getByText('No classes match')).toBeVisible()
    await page.getByRole('button', { name: 'Show all types' }).click()
    await expect(page.locator('article')).toHaveCount(2)
  })
})

test.describe('Profile', () => {
  test('avatar, membership level and badges', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Morgan Profile', email: uniqueEmail('profile'), password: PASSWORD } })
    await page.goto('/#/profile')
    await expect(page.getByRole('heading', { name: 'Morgan Profile' })).toBeVisible()
    await expect(page.locator('main').getByText('MP', { exact: true })).toBeVisible() // avatar initials
    await expect(page.getByText('Pulse Elite')).toBeVisible()
    await expect(page.getByText('Level 14')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Badges' })).toBeVisible()
    for (const badge of ['First Rep', 'On Fire', 'Iron Will', 'Early Bird', 'PR Machine', 'Class Act', 'Marathoner', 'Legend']) {
      await expect(page.getByText(badge, { exact: true })).toBeVisible()
    }
  })
})

test.describe('Branding', () => {
  test('gradient logo, pulse favicon and PulseFit in navbar, hero, title and footer', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/PulseFit/)
    await expect(page.getByRole('banner')).toContainText('PulseFit')
    await expect(page.locator('section').first()).toContainText('PulseFit')
    await expect(page.getByRole('contentinfo')).toContainText('PulseFit')

    // Logo word uses the lime → cyan gradient
    const logo = page.getByRole('banner').locator('.text-gradient').first()
    const bg = await logo.evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(bg).toMatch(/linear-gradient/)
    expect(bg).toMatch(/198, 255, 61|#C6FF3D/i) // lime
    expect(bg).toMatch(/34, 228, 242|#22E4F2/i) // cyan

    // Favicon is the pulse SVG
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
    const icon = await page.request.get('/favicon.svg')
    expect(icon.status()).toBe(200)
    expect(icon.headers()['content-type']).toMatch(/svg/)
    const svg = await icon.text()
    expect(svg).toMatch(/#C6FF3D/i)
    expect(svg).toMatch(/#22E4F2/i)
  })
})

test.describe('Navigation', () => {
  test('every nav item opens the right screen', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile')
    await page.request.post('/api/auth/signup', { data: { fullName: 'Nav Igator', email: uniqueEmail('nav'), password: PASSWORD } })
    await page.goto('/#/dashboard')
    for (const [id, s] of Object.entries(SCREENS)) {
      await clickNav(page, mobile ? s.nav.mobile : s.nav.desktop)
      await expect(page).toHaveURL(new RegExp(`#/${id}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(s.heading)
    }
    // Logo goes home; avatar goes to profile
    await page.getByRole('button', { name: /open profile/ }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/#\/profile$/)
    await page.getByRole('button', { name: 'PulseFit home' }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/#\/home$/)
  })

  test('landing links and feature cards go to the right screens', async ({ page }) => {
    await page.request.post('/api/auth/signup', { data: { fullName: 'Lou Links', email: uniqueEmail('links'), password: PASSWORD } })
    const targets = [
      ['Plan workouts', 'library'],
      ['Train live', 'live'],
      ['See progress', 'progress'],
      ['Book classes', 'classes'],
    ]
    for (const [card, id] of targets) {
      await page.goto('/')
      await page.getByRole('button', { name: new RegExp(card) }).click()
      await expect(page).toHaveURL(new RegExp(`#/${id}$`))
    }
    await page.goto('/')
    await page.getByRole('button', { name: /Explore dashboard/ }).click()
    await expect(page).toHaveURL(/#\/dashboard$/)
    await page.goto('/')
    await page.getByRole('button', { name: /Start Your Workout/ }).first().click()
    await expect(page).toHaveURL(/#\/dashboard$/) // logged in → Dashboard
    await page.goto('/')
    await expect(page.getByText('Quote of the day')).toBeVisible()
  })

  test('desktop header links (Workouts, Classes, Progress)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'these header links are desktop-only by design')
    await page.request.post('/api/auth/signup', { data: { fullName: 'Hed Er', email: uniqueEmail('header'), password: PASSWORD } })
    for (const [label, id] of [['Workouts', 'library'], ['Classes', 'classes'], ['Progress', 'progress']]) {
      await page.goto('/')
      await page.getByRole('banner').getByRole('button', { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`#/${id}$`))
    }
  })
})

test.describe('Light / dark toggle', () => {
  test('works on every screen', async ({ page }) => {
    await page.goto('/#/login')
    const toggleOn = async (where) => {
      const html = page.locator('html')
      await page.getByRole('button', { name: 'Switch to light mode' }).filter({ visible: true }).first().click()
      await expect(html, `light mode on ${where}`).not.toHaveClass(/dark/)
      await page.getByRole('button', { name: 'Switch to dark mode' }).filter({ visible: true }).first().click()
      await expect(html, `dark mode on ${where}`).toHaveClass(/dark/)
    }
    await toggleOn('login')
    await page.goto('/#/signup')
    await toggleOn('signup')
    await page.request.post('/api/auth/signup', { data: { fullName: 'Theo Theme', email: uniqueEmail('theme'), password: PASSWORD } })
    for (const id of ['home', ...Object.keys(SCREENS)]) {
      await page.goto(`/#/${id}`)
      await page.reload()
      await expect(page).toHaveURL(new RegExp(`#/${id}$`))
      await toggleOn(id)
    }
    // The choice is remembered after a reload
    await page.getByRole('button', { name: 'Switch to light mode' }).filter({ visible: true }).first().click()
    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})

test.describe('Screen sizes', () => {
  const ALL = ['home', 'dashboard', 'library', 'live', 'progress', 'classes', 'profile']

  for (const [label, width, height] of [['phone 375', 375, 812], ['tablet 768', 768, 1024], ['desktop 1440', 1440, 900]]) {
    test(`${label}px: right navigation, no sideways scrolling`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chrome', 'sizes are set explicitly, so one browser project is enough')
      await page.setViewportSize({ width, height })
      await page.request.post('/api/auth/signup', { data: { fullName: 'Size Tester', email: uniqueEmail(`size${width}`), password: PASSWORD } })
      for (const id of ALL) {
        await page.goto(`/#/${id}`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(600)
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        expect(scrollWidth, `${id} scrolls sideways at ${width}px`).toBeLessThanOrEqual(clientWidth)
        if (id === 'home') continue
        const sidebar = page.getByRole('complementary')
        const bottomNav = page.locator('nav.fixed')
        if (width >= 1024) {
          await expect(sidebar, `${id} sidebar at ${width}px`).toBeVisible()
          await expect(bottomNav, `${id} bottom bar at ${width}px`).toBeHidden()
        } else {
          await expect(sidebar, `${id} sidebar at ${width}px`).toBeHidden()
          await expect(bottomNav, `${id} bottom bar at ${width}px`).toBeVisible()
        }
      }
    })
  }

  test('landing: the floating streak chip never covers the stats row', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'sizes are set explicitly')
    for (const [width, height] of [[375, 812], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height })
      await page.goto('/')
      await page.waitForTimeout(1500)
      const overlap = await page.evaluate(() => {
        const chip = [...document.querySelectorAll('.glass')].find((e) => e.textContent.includes('-day streak')).getBoundingClientRect()
        const stats = document.querySelector('dl').getBoundingClientRect()
        return chip.top < stats.bottom && chip.bottom > stats.top && chip.left < stats.right && chip.right > stats.left
      })
      expect(overlap, `overlap at ${width}px`).toBe(false)
    }
  })

  test('phone: buttons are easy to tap (at least 24×24px, bottom bar at least 44px tall)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone', 'tap targets are a phone concern')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.request.post('/api/auth/signup', { data: { fullName: 'Tap Tester', email: uniqueEmail('tap'), password: PASSWORD } })
    const { exercises } = await (await page.request.get('/api/exercises?group=Back')).json()
    await page.request.post('/api/workouts/exercises', { data: { exerciseId: exercises[0].id, date: today() } })
    const small = []
    for (const id of ALL) {
      await page.goto(`/#/${id}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(700)
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('button, a[href], input, [role="tab"]')]
          .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
          .map((el) => ({ r: el.getBoundingClientRect(), name: (el.getAttribute('aria-label') || el.innerText || el.placeholder || el.tagName).trim().slice(0, 30) }))
          .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
          .map(({ r, name }) => `${name} (${Math.round(r.width)}×${Math.round(r.height)})`),
      )
      small.push(...found.map((f) => `${id}: ${f}`))
      const navHeights = await page.locator('nav.fixed button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
      if (id !== 'home') for (const h of navHeights) expect(h, 'bottom bar button height').toBeGreaterThanOrEqual(44)
    }
    expect(small).toEqual([])
  })
})
