import { getSql } from '../lib/db.js'
import { HttpError, handler, parseId, readBody } from '../lib/http.js'
import { requireUserId } from '../lib/auth.js'

// PATCH /api/sets { setId, completed }            → tick / untick one set
// PATCH /api/sets { workoutExerciseId, completed } → tick / untick every set of one exercise
export default handler(['PATCH'], async (req, res) => {
  const userId = await requireUserId(req)
  const body = readBody(req)
  if (typeof body.completed !== 'boolean') throw new HttpError(400, '"completed" must be true or false.')
  const completed = body.completed
  const sql = getSql()

  let rows
  if (body.setId !== undefined) {
    const setId = parseId(body.setId, 'set')
    rows = await sql`
      UPDATE workout_sets s
      SET completed = ${completed}, completed_at = CASE WHEN ${completed}::boolean THEN now() ELSE NULL END
      FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE s.id = ${setId} AND s.workout_exercise_id = we.id
        AND w.user_id = ${userId} AND w.status <> 'completed'
      RETURNING s.id, we.workout_id`
  } else {
    const workoutExerciseId = parseId(body.workoutExerciseId, 'workout exercise')
    rows = await sql`
      UPDATE workout_sets s
      SET completed = ${completed}, completed_at = CASE WHEN ${completed}::boolean THEN now() ELSE NULL END
      FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = ${workoutExerciseId} AND s.workout_exercise_id = we.id
        AND w.user_id = ${userId} AND w.status <> 'completed'
      RETURNING s.id, we.workout_id`
  }
  if (rows.length === 0) throw new HttpError(404, "We couldn't update that set. Refresh and try again.")

  // The first ticked set starts the clock
  if (completed) {
    await sql`
      UPDATE workouts SET status = 'in_progress', started_at = coalesce(started_at, now())
      WHERE id = ${rows[0].workout_id} AND user_id = ${userId} AND status = 'planned'`
  }

  res.status(200).json({ updated: rows.length, completed })
})
