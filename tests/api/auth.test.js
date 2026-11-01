import { describe, expect, it } from 'vitest'
import { PASSWORD, cookieHeader, useTestApp } from '../helpers.js'

const t = useTestApp('auth')

describe('POST /api/auth/signup', () => {
  it('creates an account, returns the user and sets an httpOnly session cookie', async () => {
    const email = t.email('new')
    const res = await t.request().post('/api/auth/signup').send({
      fullName: '  Jamie Lee ',
      email: email.toUpperCase(),
      password: PASSWORD,
      weeklyGoalWorkouts: 5,
      weeklyGoalMinutes: 200,
    })
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ fullName: 'Jamie Lee', email, weeklyGoalWorkouts: 5, weeklyGoalMinutes: 200, streak: 0 })
    expect(res.body.user).not.toHaveProperty('password_hash')
    expect(res.body.user).not.toHaveProperty('passwordHash')
    const cookies = cookieHeader(res)
    expect(cookies).toMatch(/pf_session=[^;]+;.*HttpOnly/i)
    expect(cookies).toMatch(/SameSite=Lax/i)

    const [row] = await t.sql`SELECT password_hash FROM users WHERE email = ${email}`
    expect(row.password_hash).toMatch(/^\$2[aby]\$/) // bcrypt, never plain text
    expect(row.password_hash).not.toContain(PASSWORD)
  })

  it('uses sensible default goals when none are given', async () => {
    const res = await t.request().post('/api/auth/signup').send({ fullName: 'Def Ault', email: t.email('defaults'), password: PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ weeklyGoalWorkouts: 4, weeklyGoalMinutes: 150 })
  })

  it('blocks a duplicate email (case-insensitive)', async () => {
    const { email } = await t.signup()
    const res = await t.request().post('/api/auth/signup').send({ fullName: 'Copy Cat', email: email.toUpperCase(), password: PASSWORD })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/already exists/i)
  })

  it.each([
    ['empty', ''],
    ['too short', 'Ab1!'],
    ['letters only', 'password'],
    ['numbers only', '12345678'],
    ['too long', `A1${'x'.repeat(80)}`],
  ])('blocks a weak or empty password (%s)', async (_, password) => {
    const res = await t.request().post('/api/auth/signup').send({ fullName: 'Weak Pass', email: t.email('weak'), password })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/password/i)
  })

  it.each([
    ['missing name', { fullName: '   ' }, /name/i],
    ['bad email', { email: 'not-an-email' }, /email/i],
    ['goal too high', { weeklyGoalWorkouts: 99 }, /between 1 and 14/],
    ['goal not a number', { weeklyGoalMinutes: 'lots' }, /between 15 and 1500/],
  ])('rejects invalid input (%s)', async (_, override, message) => {
    const res = await t.request().post('/api/auth/signup').send({ fullName: 'Val Idate', email: t.email('invalid'), password: PASSWORD, ...override })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(message)
  })

  it('rejects malformed JSON with a friendly 400', async () => {
    const res = await t.request().post('/api/auth/signup').set('Content-Type', 'application/json').send('{"oops":')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/valid JSON/i)
  })

  it('only allows POST', async () => {
    const res = await t.request().get('/api/auth/signup')
    expect(res.status).toBe(405)
  })
})

describe('POST /api/auth/login and /logout', () => {
  it('logs in with the right password (email is case-insensitive)', async () => {
    const { email } = await t.signup({ fullName: 'Log Inner' })
    const res = await t.request().post('/api/auth/login').send({ email: `  ${email.toUpperCase()} `, password: PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email, fullName: 'Log Inner' })
    expect(cookieHeader(res)).toMatch(/pf_session=[^;]+;.*HttpOnly/i)
  })

  it('fails with the wrong password, without revealing which part was wrong', async () => {
    const { email } = await t.signup()
    const wrong = await t.request().post('/api/auth/login').send({ email, password: 'Wrong1234!' })
    const unknown = await t.request().post('/api/auth/login').send({ email: t.email('nobody'), password: PASSWORD })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error).toBe(unknown.body.error)
    expect(cookieHeader(wrong)).not.toMatch(/pf_session=[^;]+;/)
  })

  it('rejects an empty login form', async () => {
    const res = await t.request().post('/api/auth/login').send({})
    expect(res.status).toBe(400)
  })

  it('logout clears the cookie and the session stops working', async () => {
    const { agent } = await t.signup()
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    const res = await agent.post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(cookieHeader(res)).toMatch(/pf_session=;.*Max-Age=0/i)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const { agent, email } = await t.signup({ fullName: 'Me Myself' })
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email, fullName: 'Me Myself', streak: 0 })
  })

  it('returns 401 when logged out', async () => {
    const res = await t.request().get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.user).toBeNull()
  })

  it('returns 401 for a forged or tampered cookie', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLWZha2U'
    const res = await t.request().get('/api/auth/me').set('Cookie', `pf_session=${forged}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 (and clears the cookie) if the account was deleted', async () => {
    const { agent, user } = await t.signup()
    await t.sql`DELETE FROM users WHERE id = ${user.id}`
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(cookieHeader(res)).toMatch(/Max-Age=0/)
  })
})
