import bcrypt from 'bcryptjs'
import { getSql } from '../../lib/db.js'
import { HttpError, handler, parseDate, readBody } from '../../lib/http.js'
import { publicUser, startSession } from '../../lib/auth.js'
import { getStreak } from '../../lib/workouts.js'

export default handler(['POST'], async (req, res) => {
  const body = readBody(req)
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!email || !password) throw new HttpError(400, 'Please enter your email and password.')

  const sql = getSql()
  const [user] = await sql`
    SELECT id, email, password_hash, full_name, weekly_goal_workouts, weekly_goal_minutes, created_at
    FROM users WHERE email = ${email}`
  const ok = user && (await bcrypt.compare(password, user.password_hash))
  if (!ok) throw new HttpError(401, 'That email and password don’t match. Please try again.')

  await startSession(res, user.id)
  const streak = await getStreak(sql, user.id, parseDate(body.date))
  res.status(200).json({ user: { ...publicUser(user), streak: streak.current } })
})
