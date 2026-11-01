import { describe, expect, it } from 'vitest'
import { useTestApp } from '../helpers.js'

const t = useTestApp('public')
const GROUPS = ['Chest', 'Back', 'Legs', 'Arms', 'Core', 'Cardio']

describe('GET /api/stats', () => {
  it('returns members, workouts completed and classes this week as numbers', async () => {
    const res = await t.request().get('/api/stats')
    expect(res.status).toBe(200)
    for (const key of ['members', 'workoutsCompleted', 'classesThisWeek']) {
      expect(typeof res.body[key], key).toBe('number')
      expect(Number.isInteger(res.body[key]), key).toBe(true)
      expect(res.body[key], key).toBeGreaterThanOrEqual(0)
    }
    expect(res.body.classesThisWeek).toBe(10)
  })

  it('counts real members and completed workouts', async () => {
    const before = (await t.request().get('/api/stats')).body
    const { user } = await t.signup()
    await t.addCompletedWorkout(user.id, '2026-01-05', 40)
    await t.addCompletedWorkout(user.id, '2026-01-06', 40, 'planned') // not completed → not counted
    const after = (await t.request().get('/api/stats')).body
    expect(after.members).toBe(before.members + 1)
    expect(after.workoutsCompleted).toBe(before.workoutsCompleted + 1)
  })

  it('is public (no login needed) and read-only', async () => {
    expect((await t.request().post('/api/stats')).status).toBe(405)
  })
})

describe('GET /api/exercises', () => {
  it('returns all 30 exercises with their details', async () => {
    const res = await t.request().get('/api/exercises')
    expect(res.status).toBe(200)
    expect(res.body.exercises).toHaveLength(30)
    for (const e of res.body.exercises) {
      expect(e).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        muscleGroup: expect.stringMatching(/^(Chest|Back|Legs|Arms|Core|Cardio)$/),
        sets: expect.any(Number),
        reps: expect.any(String),
        difficulty: expect.stringMatching(/^(Beginner|Intermediate|Advanced)$/),
        restSeconds: expect.any(Number),
        description: expect.any(String),
      })
    }
    expect(new Set(res.body.exercises.map((e) => e.name)).size).toBe(30)
  })

  it.each(GROUPS)('filters by muscle group: %s', async (group) => {
    const res = await t.request().get(`/api/exercises?group=${group}`)
    expect(res.status).toBe(200)
    expect(res.body.exercises).toHaveLength(5)
    expect(res.body.exercises.every((e) => e.muscleGroup === group)).toBe(true)
  })

  it('"All" returns everything', async () => {
    expect((await t.request().get('/api/exercises?group=All')).body.exercises).toHaveLength(30)
  })

  it('rejects an unknown muscle group', async () => {
    const res = await t.request().get('/api/exercises?group=Neck')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Unknown muscle group/)
  })

  it('returns 404 JSON for unknown API routes', async () => {
    const res = await t.request().get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBeTruthy()
  })
})
