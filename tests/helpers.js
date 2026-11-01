import request from 'supertest'
import { afterAll, beforeAll, expect } from 'vitest'
import { createApp } from '../server/app.js'
import { getSql } from '../lib/db.js'

export const PASSWORD = 'Test1234!'

/**
 * Boots the real /api routes in-process for one test file.
 * Every user it creates has an email like vitest+<tag>-…@pulsefit.test and is deleted afterwards
 * (their workouts and sets go with them via ON DELETE CASCADE).
 */
export function useTestApp(tag) {
  const ctx = {}
  const prefix = `vitest+${tag}-`

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      const { openLocalDb } = await import('../server/local-db.js')
      const local = await openLocalDb({ dir: null }) // in-memory, schema + seed applied
      globalThis.__pulsefitLocalSql = local.sql
      ctx.closeDb = () => local.db.close()
    }
    ctx.app = (await createApp()).app
    ctx.sql = getSql()
  })

  afterAll(async () => {
    if (ctx.sql) await ctx.sql`DELETE FROM users WHERE email LIKE ${`${prefix}%`}`
    await ctx.closeDb?.()
  })

  ctx.email = (label = 'user') => `${prefix}${label}-${Date.now()}${Math.random().toString(36).slice(2, 7)}@pulsefit.test`

  /** Signs up a fresh user and returns a cookie-keeping agent for them. */
  ctx.signup = async (overrides = {}) => {
    const agent = request.agent(ctx.app)
    const body = {
      fullName: 'Vitest User',
      email: ctx.email(),
      password: PASSWORD,
      weeklyGoalWorkouts: 4,
      weeklyGoalMinutes: 150,
      ...overrides,
    }
    const res = await agent.post('/api/auth/signup').send(body)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return { agent, user: res.body.user, email: body.email }
  }

  ctx.request = () => request(ctx.app)

  /** Inserts a completed workout directly, for date-based streak/stat tests. */
  ctx.addCompletedWorkout = (userId, date, minutes = 30, status = 'completed') =>
    ctx.sql`
      INSERT INTO workouts (user_id, name, workout_date, status, duration_minutes, started_at, completed_at)
      VALUES (${userId}, 'Seeded', ${date}::date, ${status}, ${minutes}, now(), ${status === 'completed' ? new Date() : null})`

  return ctx
}

export function cookieHeader(res) {
  const raw = res.headers['set-cookie']
  return Array.isArray(raw) ? raw.join('\n') : (raw ?? '')
}
