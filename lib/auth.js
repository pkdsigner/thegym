import { SignJWT, jwtVerify } from 'jose'
import { MissingConfigError } from './db.js'
import { HttpError, getCookie } from './http.js'

const COOKIE = 'pf_session'
// Non-secret companion cookie the browser *can* read: it only says "a session probably exists",
// so the app skips calling /api/auth/me (and logging a 401) for visitors who never logged in.
const HINT_COOKIE = 'pf_hint'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret() {
  if (!process.env.JWT_SECRET) throw new MissingConfigError('JWT_SECRET')
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

function cookies(token, maxAge) {
  const secure = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return [
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
    `${HINT_COOKIE}=${maxAge ? 1 : ''}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  ]
}

export async function startSession(res, userId) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret())
  res.setHeader('Set-Cookie', cookies(token, MAX_AGE))
}

export function endSession(res) {
  res.setHeader('Set-Cookie', cookies('', 0))
}

export async function getUserId(req) {
  const key = secret()
  const token = getCookie(req, COOKIE)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    const id = Number(payload.sub)
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

export async function requireUserId(req) {
  const id = await getUserId(req)
  if (!id) throw new HttpError(401, 'Please log in to continue.')
  return id
}

export function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    weeklyGoalWorkouts: row.weekly_goal_workouts,
    weeklyGoalMinutes: row.weekly_goal_minutes,
    createdAt: row.created_at,
  }
}
