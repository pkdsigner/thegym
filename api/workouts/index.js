import { getSql } from '../../lib/db.js'
import { handler, parseDate } from '../../lib/http.js'
import { requireUserId } from '../../lib/auth.js'
import { getWorkoutForDate } from '../../lib/workouts.js'

// GET /api/workouts?date=YYYY-MM-DD → the logged-in user's workout for that day (or null)
export default handler(['GET'], async (req, res) => {
  const userId = await requireUserId(req)
  const workout = await getWorkoutForDate(getSql(), userId, parseDate(req.query?.date))
  res.status(200).json({ workout })
})
