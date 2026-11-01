import { getSql } from '../lib/db.js'
import { handler, parseDate } from '../lib/http.js'
import { requireUserId } from '../lib/auth.js'
import { getStreak, getWorkoutForDate } from '../lib/workouts.js'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default handler(['GET'], async (req, res) => {
  const userId = await requireUserId(req)
  const date = parseDate(req.query?.date)
  const sql = getSql()

  const [[user], activity, [totals], streak, today] = await Promise.all([
    sql`SELECT weekly_goal_workouts, weekly_goal_minutes FROM users WHERE id = ${userId}`,
    // Active minutes per day for the last 7 days (completed workouts only)
    sql`
      SELECT d::date::text AS date, coalesce(sum(w.duration_minutes), 0)::int AS minutes
      FROM generate_series(${date}::date - 6, ${date}::date, INTERVAL '1 day') AS d
      LEFT JOIN workouts w ON w.user_id = ${userId} AND w.status = 'completed' AND w.workout_date = d::date
      GROUP BY d ORDER BY d`,
    sql`
      SELECT
        coalesce(sum(duration_minutes) FILTER (WHERE workout_date BETWEEN ${date}::date - 13 AND ${date}::date - 7), 0)::int AS previous_minutes,
        count(*) FILTER (WHERE workout_date BETWEEN date_trunc('week', ${date}::date)::date AND ${date}::date)::int AS week_workouts,
        coalesce(sum(duration_minutes) FILTER (WHERE workout_date BETWEEN date_trunc('week', ${date}::date)::date AND ${date}::date), 0)::int AS week_minutes
      FROM workouts
      WHERE user_id = ${userId} AND status = 'completed'`,
    getStreak(sql, userId, date),
    getWorkoutForDate(sql, userId, date),
  ])

  const goalWorkouts = user?.weekly_goal_workouts ?? 4
  const goalMinutes = user?.weekly_goal_minutes ?? 150
  const goalsHit = Number(totals.week_workouts >= goalWorkouts) + Number(totals.week_minutes >= goalMinutes)

  res.status(200).json({
    today,
    activity: activity.map((a) => ({
      date: a.date,
      day: DAY_LABELS[new Date(`${a.date}T00:00:00Z`).getUTCDay()],
      minutes: a.minutes,
    })),
    previousWeekMinutes: totals.previous_minutes,
    streak,
    week: {
      workouts: totals.week_workouts,
      minutes: totals.week_minutes,
      goalWorkouts,
      goalMinutes,
      goalsHit,
      goalsTotal: 2,
    },
  })
})
