export const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Arms', 'Core', 'Cardio']

// ~45s of work per set plus the prescribed rest
export function estimateMinutes(workout) {
  const seconds = workout.exercises.reduce((n, e) => n + e.sets.length * (45 + e.restSeconds), 0)
  return Math.max(1, Math.round(seconds / 60))
}
