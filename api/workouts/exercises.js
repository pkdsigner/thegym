import { getSql } from '../../lib/db.js'
import { HttpError, handler, parseDate, parseId, readBody } from '../../lib/http.js'
import { requireUserId } from '../../lib/auth.js'
import { getWorkoutForDate } from '../../lib/workouts.js'

// POST /api/workouts/exercises { exerciseId, date } → add an exercise (with its sets) to today's workout
export default handler(['POST'], async (req, res) => {
  const userId = await requireUserId(req)
  const body = readBody(req)
  const exerciseId = parseId(body.exerciseId, 'exercise')
  const date = parseDate(body.date)
  const sql = getSql()

  const [exercise] = await sql`SELECT id, name, muscle_group, sets FROM exercises WHERE id = ${exerciseId}`
  if (!exercise) throw new HttpError(404, 'That exercise no longer exists.')

  // Reuse today's open workout, or start a fresh one (e.g. if today's was already completed)
  let [workout] = await sql`
    SELECT id FROM workouts
    WHERE user_id = ${userId} AND workout_date = ${date}::date AND status <> 'completed'
    ORDER BY id DESC LIMIT 1`
  if (!workout) {
    ;[workout] = await sql`
      INSERT INTO workouts (user_id, name, workout_date)
      VALUES (${userId}, ${`${exercise.muscle_group} Day`}, ${date}::date)
      RETURNING id`
  }

  const inserted = await sql`
    WITH we AS (
      INSERT INTO workout_exercises (workout_id, exercise_id, order_index)
      SELECT ${workout.id}::int, ${exerciseId}::int, coalesce(max(order_index) + 1, 0)
      FROM workout_exercises WHERE workout_id = ${workout.id}
      ON CONFLICT (workout_id, exercise_id) DO NOTHING
      RETURNING id
    )
    INSERT INTO workout_sets (workout_exercise_id, set_number)
    SELECT we.id, n FROM we, generate_series(1, ${exercise.sets}::int) AS n
    RETURNING workout_exercise_id`
  if (inserted.length === 0) throw new HttpError(409, `${exercise.name} is already in today's workout.`)

  // Name the workout after the muscle groups it covers
  await sql`
    UPDATE workouts SET name = (
      SELECT CASE count(DISTINCT e.muscle_group)
        WHEN 1 THEN min(e.muscle_group) || ' Day'
        WHEN 2 THEN min(e.muscle_group) || ' & ' || max(e.muscle_group)
        ELSE 'Full Body Mix' END
      FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
      WHERE we.workout_id = ${workout.id})
    WHERE id = ${workout.id}`

  res.status(201).json({ added: exercise.name, workout: await getWorkoutForDate(sql, userId, date) })
})
