import { getSql } from '../../lib/db.js'
import { HttpError, handler, parseId, readBody } from '../../lib/http.js'
import { requireUserId } from '../../lib/auth.js'

// POST /api/workouts/start { workoutId, restart? } → mark in progress (restart also clears all ticked sets)
export default handler(['POST'], async (req, res) => {
  const userId = await requireUserId(req)
  const body = readBody(req)
  const workoutId = parseId(body.workoutId, 'workout')
  const restart = body.restart === true
  const sql = getSql()

  const [workout] = await sql`
    UPDATE workouts
    SET status = 'in_progress',
        started_at = CASE WHEN ${restart}::boolean OR started_at IS NULL THEN now() ELSE started_at END
    WHERE id = ${workoutId} AND user_id = ${userId} AND status <> 'completed'
    RETURNING id, status, started_at`
  if (!workout) throw new HttpError(404, "We couldn't find that workout, or it's already finished.")

  if (restart) {
    await sql`
      UPDATE workout_sets s SET completed = false, completed_at = NULL
      FROM workout_exercises we
      WHERE s.workout_exercise_id = we.id AND we.workout_id = ${workoutId}`
  }

  res.status(200).json({ workout: { id: workout.id, status: workout.status, startedAt: workout.started_at } })
})
