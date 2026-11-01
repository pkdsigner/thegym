import { getSql } from '../lib/db.js'
import { handler } from '../lib/http.js'

// Public numbers for the landing page.
export default handler(['GET'], async (req, res) => {
  const sql = getSql()
  const [row] = await sql`
    SELECT
      (SELECT count(*) FROM users)::int AS members,
      (SELECT count(*) FROM workouts WHERE status = 'completed')::int AS workouts_completed,
      (SELECT count(*) FROM classes
        WHERE start_time >= date_trunc('week', now())
          AND start_time <  date_trunc('week', now()) + INTERVAL '7 days')::int AS classes_this_week`
  res.status(200).json({
    members: row.members,
    workoutsCompleted: row.workouts_completed,
    classesThisWeek: row.classes_this_week,
  })
})
