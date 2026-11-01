import { getSql } from '../lib/db.js'
import { HttpError, handler } from '../lib/http.js'

const GROUPS = ['Chest', 'Back', 'Legs', 'Arms', 'Core', 'Cardio']

export default handler(['GET'], async (req, res) => {
  const group = req.query?.group
  if (group && group !== 'All' && !GROUPS.includes(group)) throw new HttpError(400, `Unknown muscle group "${group}".`)
  const filter = group && group !== 'All' ? group : null

  const sql = getSql()
  const rows = await sql`
    SELECT id, name, muscle_group, sets, reps, difficulty, rest_seconds, description
    FROM exercises
    WHERE ${filter}::text IS NULL OR muscle_group = ${filter}
    ORDER BY array_position(${GROUPS}::text[], muscle_group), name`

  res.status(200).json({
    exercises: rows.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscle_group,
      sets: e.sets,
      reps: e.reps,
      difficulty: e.difficulty,
      restSeconds: e.rest_seconds,
      description: e.description,
    })),
  })
})
