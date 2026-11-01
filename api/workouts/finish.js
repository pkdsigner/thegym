import { getSql } from '../../lib/db.js'
import { HttpError, handler, parseId, readBody } from '../../lib/http.js'
import { requireUserId } from '../../lib/auth.js'

// POST /api/workouts/finish { workoutId } → mark completed and save the duration
export default handler(['POST'], async (req, res) => {
  const userId = await requireUserId(req)
  const workoutId = parseId(readBody(req).workoutId, 'workout')
  const sql = getSql()

  let [workout] = await sql`
    UPDATE workouts
    SET status = 'completed',
        started_at = coalesce(started_at, now()),
        completed_at = now(),
        duration_minutes = greatest(1, round(extract(epoch FROM now() - coalesce(started_at, now())) / 60))::int
    WHERE id = ${workoutId} AND user_id = ${userId} AND status <> 'completed'
    RETURNING id, status, duration_minutes, started_at, completed_at`

  // Already finished (e.g. a double tap) — return it instead of failing
  if (!workout) {
    ;[workout] = await sql`
      SELECT id, status, duration_minutes, started_at, completed_at
      FROM workouts WHERE id = ${workoutId} AND user_id = ${userId} AND status = 'completed'`
  }
  if (!workout) throw new HttpError(404, "We couldn't find that workout.")

  res.status(200).json({
    workout: {
      id: workout.id,
      status: workout.status,
      durationMinutes: workout.duration_minutes,
      startedAt: workout.started_at,
      completedAt: workout.completed_at,
    },
  })
})
