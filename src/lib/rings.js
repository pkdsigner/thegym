// Progress-ring math, kept pure so it can be unit-tested.

/** 0–1 fill for a ring. Never NaN, never above 1 (100%), never below 0. */
export function ringProgress(value, goal) {
  const ratio = Number(value) / Number(goal)
  if (!Number.isFinite(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

/** The three dashboard rings plus the overall weekly percentage (0–100). */
export function weekRings(week = {}) {
  const rings = [
    { key: 'workouts', label: 'Workouts', value: week.workouts, goal: week.goalWorkouts, unit: '', color: '#C6FF3D' },
    { key: 'minutes', label: 'Active min', value: week.minutes, goal: week.goalMinutes, unit: 'min', color: '#22E4F2' },
    { key: 'goals', label: 'Goals hit', value: week.goalsHit, goal: week.goalsTotal, unit: '', color: '#FF7A3D' },
  ].map((r) => ({
    ...r,
    value: Number.isFinite(Number(r.value)) ? Number(r.value) : 0,
    goal: Number.isFinite(Number(r.goal)) ? Number(r.goal) : 0,
    progress: ringProgress(r.value, r.goal),
  }))
  const percent = Math.round(((rings[0].progress + rings[1].progress) / 2) * 100)
  return { rings, percent }
}
