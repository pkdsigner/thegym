import { describe, expect, it } from 'vitest'
import { ringProgress, weekRings } from '../../src/lib/rings.js'
import { estimateMinutes } from '../../src/lib/workout.js'

describe('ringProgress', () => {
  it.each([
    [2, 4, 0.5],
    [4, 4, 1],
    [9, 4, 1], // over goal → capped at 100%
    [0, 4, 0],
    [-3, 4, 0],
    [5, 0, 0], // goal of 0 → no division by zero
    [0, 0, 0], // 0/0 would be NaN
    [undefined, 4, 0],
    [3, undefined, 0],
    [null, null, 0],
    ['abc', 4, 0],
    [Infinity, 4, 0],
  ])('ringProgress(%s, %s) = %s', (value, goal, expected) => {
    const p = ringProgress(value, goal)
    expect(p).toBe(expected)
    expect(Number.isNaN(p)).toBe(false)
  })
})

describe('weekRings', () => {
  it('never goes above 100% even when goals are smashed', () => {
    const { rings, percent } = weekRings({ workouts: 12, minutes: 900, goalWorkouts: 4, goalMinutes: 150, goalsHit: 2, goalsTotal: 2 })
    expect(rings.map((r) => r.progress)).toEqual([1, 1, 1])
    expect(percent).toBe(100)
  })

  it('never shows NaN for a brand-new or broken payload', () => {
    for (const week of [{}, undefined, { workouts: 0, minutes: 0, goalWorkouts: 0, goalMinutes: 0, goalsHit: 0, goalsTotal: 0 }, { workouts: 'x' }]) {
      const { rings, percent } = weekRings(week)
      expect(Number.isNaN(percent)).toBe(false)
      for (const r of rings) {
        expect(Number.isNaN(r.progress)).toBe(false)
        expect(Number.isNaN(r.value)).toBe(false)
        expect(Number.isNaN(r.goal)).toBe(false)
      }
    }
  })

  it('computes the overall percentage from workouts and minutes', () => {
    expect(weekRings({ workouts: 1, minutes: 75, goalWorkouts: 4, goalMinutes: 150, goalsHit: 0, goalsTotal: 2 }).percent).toBe(38) // (25% + 50%) / 2
  })
})

describe('estimateMinutes', () => {
  it('adds ~45s of work plus rest per set, at least 1 minute', () => {
    const workout = { exercises: [{ restSeconds: 60, sets: [{}, {}, {}] }, { restSeconds: 75, sets: [{}, {}] }] }
    expect(estimateMinutes(workout)).toBe(Math.round((3 * 105 + 2 * 120) / 60))
    expect(estimateMinutes({ exercises: [] })).toBe(1)
  })
})
