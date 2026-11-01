import { getSql } from '../../lib/db.js'
import { handler, parseDate } from '../../lib/http.js'
import { endSession, getUserId, publicUser } from '../../lib/auth.js'
import { getStreak } from '../../lib/workouts.js'

const NOT_LOGGED_IN = { user: null, error: 'Please log in to continue.' }

export default handler(['GET'], async (req, res) => {
  const userId = await getUserId(req)
  if (!userId) {
    endSession(res) // also clears a stale "logged in" hint cookie
    return res.status(401).json(NOT_LOGGED_IN)
  }

  const sql = getSql()
  const [user] = await sql`
    SELECT id, email, full_name, weekly_goal_workouts, weekly_goal_minutes, created_at
    FROM users WHERE id = ${userId}`
  if (!user) {
    endSession(res)
    return res.status(401).json(NOT_LOGGED_IN)
  }
  const streak = await getStreak(sql, userId, parseDate(req.query?.date))
  res.status(200).json({ user: { ...publicUser(user), streak: streak.current } })
})
