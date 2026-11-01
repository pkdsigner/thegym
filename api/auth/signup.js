import bcrypt from 'bcryptjs'
import { getSql } from '../../lib/db.js'
import { HttpError, handler, readBody } from '../../lib/http.js'
import { publicUser, startSession } from '../../lib/auth.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function intInRange(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`)
  return n
}

export default handler(['POST'], async (req, res) => {
  const body = readBody(req)
  const fullName = String(body.fullName ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const goalWorkouts = intInRange(body.weeklyGoalWorkouts, 4, 1, 14, 'Weekly workouts goal')
  const goalMinutes = intInRange(body.weeklyGoalMinutes, 150, 15, 1500, 'Weekly minutes goal')

  if (!fullName || fullName.length > 80) throw new HttpError(400, 'Please tell us your name (up to 80 characters).')
  if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, 'Please enter a valid email address.')
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.')
  if (password.length > 72) throw new HttpError(400, 'Password must be 72 characters or fewer.')
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password needs at least one letter and one number.')
  }

  const sql = getSql()
  const hash = await bcrypt.hash(password, 10)
  const [user] = await sql`
    INSERT INTO users (email, password_hash, full_name, weekly_goal_workouts, weekly_goal_minutes)
    VALUES (${email}, ${hash}, ${fullName}, ${goalWorkouts}, ${goalMinutes})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, full_name, weekly_goal_workouts, weekly_goal_minutes, created_at`
  if (!user) throw new HttpError(409, 'An account with this email already exists. Try logging in instead.')

  await startSession(res, user.id)
  res.status(201).json({ user: { ...publicUser(user), streak: 0 } })
})
