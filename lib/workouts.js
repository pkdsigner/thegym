// Queries shared by several routes. Every query is scoped to a user id.

// Current streak = consecutive days with a completed workout, ending today or yesterday.
export async function getStreak(sql, userId, date) {
  const [row] = await sql`
    WITH days AS (
      SELECT DISTINCT workout_date AS d FROM workouts
      WHERE user_id = ${userId} AND status = 'completed' AND workout_date <= ${date}::date
    ),
    runs AS (
      SELECT max(d) AS last_day, count(*)::int AS len
      FROM (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days) g
      GROUP BY grp
    )
    SELECT
      coalesce(max(len), 0)::int AS best,
      coalesce((SELECT len FROM runs WHERE last_day >= ${date}::date - 1 ORDER BY last_day DESC LIMIT 1), 0)::int AS current
    FROM runs`
  return { current: row.current, best: row.best }
}

// The workout shown for a given day: an open one if there is any, otherwise the last completed one.
export async function getWorkoutForDate(sql, userId, date) {
  const [workout] = await sql`
    SELECT id, name, workout_date::text AS date, status, duration_minutes, started_at, completed_at
    FROM workouts
    WHERE user_id = ${userId} AND workout_date = ${date}::date
    ORDER BY (status = 'completed') ASC, id DESC
    LIMIT 1`
  if (!workout) return null

  const exercises = await sql`
    SELECT we.id, we.order_index, e.id AS exercise_id, e.name, e.muscle_group, e.reps, e.difficulty, e.rest_seconds,
      coalesce(
        json_agg(json_build_object('id', s.id, 'setNumber', s.set_number, 'completed', s.completed) ORDER BY s.set_number)
          FILTER (WHERE s.id IS NOT NULL),
        '[]'
      ) AS sets
    FROM workout_exercises we
    JOIN exercises e ON e.id = we.exercise_id
    LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id
    WHERE we.workout_id = ${workout.id}
    GROUP BY we.id, e.id
    ORDER BY we.order_index, we.id`

  return {
    id: workout.id,
    name: workout.name,
    date: workout.date,
    status: workout.status,
    durationMinutes: workout.duration_minutes,
    startedAt: workout.started_at,
    completedAt: workout.completed_at,
    exercises: exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exercise_id,
      name: e.name,
      muscleGroup: e.muscle_group,
      reps: e.reps,
      difficulty: e.difficulty,
      restSeconds: e.rest_seconds,
      sets: e.sets,
    })),
  }
}
