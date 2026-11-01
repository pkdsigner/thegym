import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTestApp } from '../helpers.js'

const t = useTestApp('dashboard')

// Fake "today" is Wednesday 11 March 2026. Week starts Monday 9 March.
const D = '2026-03-11'
const shift = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function dashboardFor(agent, date = D) {
  const res = await agent.get(`/api/dashboard?date=${date}`)
  expect(res.status).toBe(200)
  return res.body
}

describe('streak (with fake dates)', () => {
  it('no workouts → streak 0', async () => {
    const { agent } = await t.signup()
    const d = await dashboardFor(agent)
    expect(d.streak).toEqual({ current: 0, best: 0 })
  })

  it('3 days in a row ending today → streak 3', async () => {
    const { agent, user } = await t.signup()
    for (const offset of [-2, -1, 0]) await t.addCompletedWorkout(user.id, shift(D, offset))
    expect((await dashboardFor(agent)).streak).toEqual({ current: 3, best: 3 })
  })

  it('a missed day resets the streak (best streak is remembered)', async () => {
    const { agent, user } = await t.signup()
    // Trained 5, 6, 7 Mar · missed 8 Mar · trained 9 Mar · missed 10 Mar (yesterday)
    for (const offset of [-6, -5, -4, /* -3 missed */ -2]) await t.addCompletedWorkout(user.id, shift(D, offset))
    // Nothing yesterday → streak is broken, but the best run of 3 is remembered
    let d = await dashboardFor(agent)
    expect(d.streak).toEqual({ current: 0, best: 3 })
    // train today only → streak restarts at 1 (yesterday was missed)
    await t.addCompletedWorkout(user.id, D)
    d = await dashboardFor(agent)
    expect(d.streak).toEqual({ current: 1, best: 3 })
  })

  it('a workout today plus yesterday → streak 2', async () => {
    const { agent, user } = await t.signup()
    await t.addCompletedWorkout(user.id, shift(D, -1))
    await t.addCompletedWorkout(user.id, D)
    expect((await dashboardFor(agent)).streak.current).toBe(2)
  })

  it("yesterday's workout keeps the streak alive until you train today", async () => {
    const { agent, user } = await t.signup()
    await t.addCompletedWorkout(user.id, shift(D, -2))
    await t.addCompletedWorkout(user.id, shift(D, -1))
    expect((await dashboardFor(agent)).streak.current).toBe(2)
  })

  it('two workouts on the same day count once; planned / unfinished workouts do not count', async () => {
    const { agent, user } = await t.signup()
    await t.addCompletedWorkout(user.id, D)
    await t.addCompletedWorkout(user.id, D)
    await t.addCompletedWorkout(user.id, shift(D, -1), 30, 'planned')
    await t.addCompletedWorkout(user.id, shift(D, -1), 30, 'in_progress')
    expect((await dashboardFor(agent)).streak).toEqual({ current: 1, best: 1 })
  })

  it('future workouts are ignored when looking at an earlier date', async () => {
    const { agent, user } = await t.signup()
    await t.addCompletedWorkout(user.id, shift(D, 1))
    expect((await dashboardFor(agent)).streak.current).toBe(0)
  })

  describe('without a date from the browser, the server uses its own clock', () => {
    afterEach(() => vi.useRealTimers())

    it('uses the (fake) system date', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-03-11T12:00:00Z'))
      const { agent, user } = await t.signup()
      await t.addCompletedWorkout(user.id, '2026-03-10')
      await t.addCompletedWorkout(user.id, '2026-03-11')
      const res = await agent.get('/api/dashboard')
      expect(res.body.streak.current).toBe(2)
      expect(res.body.activity.at(-1).date).toBe('2026-03-11')
    })
  })
})

describe('weekly chart and progress rings', () => {
  it('returns exactly 7 days ending today, with minutes per day', async () => {
    const { agent, user } = await t.signup({ weeklyGoalWorkouts: 3, weeklyGoalMinutes: 90 })
    await t.addCompletedWorkout(user.id, '2026-03-02', 25) // previous 7-day window
    await t.addCompletedWorkout(user.id, '2026-03-08', 60) // Sunday (last week, but in the 7-day chart)
    await t.addCompletedWorkout(user.id, '2026-03-09', 30)
    await t.addCompletedWorkout(user.id, '2026-03-10', 45)
    await t.addCompletedWorkout(user.id, '2026-03-11', 20)
    await t.addCompletedWorkout(user.id, '2026-03-11', 999, 'planned') // not completed → ignored

    const d = await dashboardFor(agent)
    expect(d.activity).toHaveLength(7)
    expect(d.activity.map((a) => a.date)).toEqual(['2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11'])
    expect(d.activity.map((a) => a.day)).toEqual(['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'])
    expect(d.activity.map((a) => a.minutes)).toEqual([0, 0, 0, 60, 30, 45, 20])
    expect(d.previousWeekMinutes).toBe(25)

    // Rings count Monday → today only
    expect(d.week).toEqual({ workouts: 3, minutes: 95, goalWorkouts: 3, goalMinutes: 90, goalsHit: 2, goalsTotal: 2 })
    expect(d.streak).toEqual({ current: 4, best: 4 })
  })

  it('a brand-new user gets zeros, never null/NaN', async () => {
    const { agent } = await t.signup()
    const d = await dashboardFor(agent)
    expect(d.today).toBeNull()
    expect(d.activity.every((a) => a.minutes === 0)).toBe(true)
    for (const v of Object.values(d.week)) expect(Number.isFinite(v)).toBe(true)
    expect(d.week).toMatchObject({ workouts: 0, minutes: 0, goalsHit: 0 })
  })

  it("today's workout card reflects the workout in the database", async () => {
    const { agent } = await t.signup()
    const ex = (await agent.get('/api/exercises?group=Core')).body.exercises[0]
    await agent.post('/api/workouts/exercises').send({ exerciseId: ex.id, date: D })
    const d = await dashboardFor(agent)
    expect(d.today).toMatchObject({ status: 'planned', name: 'Core Day' })
    expect(d.today.exercises[0].name).toBe(ex.name)
  })

  it('an invalid date falls back to today instead of crashing', async () => {
    const { agent } = await t.signup()
    const res = await agent.get('/api/dashboard?date=not-a-date')
    expect(res.status).toBe(200)
    expect(res.body.activity).toHaveLength(7)
  })
})
