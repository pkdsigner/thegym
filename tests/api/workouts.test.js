import { beforeAll, describe, expect, it } from 'vitest'
import { useTestApp } from '../helpers.js'

const t = useTestApp('workouts')
const TODAY = '2026-03-11'
let exercises

beforeAll(async () => {
  exercises = (await t.request().get('/api/exercises')).body.exercises
})
const byName = (name) => exercises.find((e) => e.name === name)

describe('protected routes', () => {
  it.each([
    ['get', '/api/dashboard'],
    ['get', '/api/workouts'],
    ['post', '/api/workouts/exercises'],
    ['post', '/api/workouts/start'],
    ['post', '/api/workouts/finish'],
    ['patch', '/api/sets'],
  ])('%s %s returns 401 without login', async (method, path) => {
    const res = await t.request()[method](path).send({})
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/log in/i)
  })
})

describe('workout lifecycle: create → add → start → tick → complete', () => {
  let agent, workout

  it('starts with no workout today', async () => {
    ;({ agent } = await t.signup())
    const res = await agent.get(`/api/workouts?date=${TODAY}`)
    expect(res.status).toBe(200)
    expect(res.body.workout).toBeNull()
  })

  it("adding the first exercise creates today's workout with that exercise's sets", async () => {
    const ex = byName('Tempo Push-Up')
    const res = await agent.post('/api/workouts/exercises').send({ exerciseId: ex.id, date: TODAY })
    expect(res.status).toBe(201)
    workout = res.body.workout
    expect(workout).toMatchObject({ date: TODAY, status: 'planned', name: 'Chest Day', startedAt: null })
    expect(workout.exercises).toHaveLength(1)
    expect(workout.exercises[0]).toMatchObject({ exerciseId: ex.id, restSeconds: ex.restSeconds })
    expect(workout.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3].slice(0, ex.sets))
    expect(workout.exercises[0].sets.every((s) => s.completed === false)).toBe(true)
  })

  it('adds a second exercise to the same workout and renames it', async () => {
    const res = await agent.post('/api/workouts/exercises').send({ exerciseId: byName('Lat Pulldown').id, date: TODAY })
    expect(res.status).toBe(201)
    expect(res.body.workout.id).toBe(workout.id)
    expect(res.body.workout.name).toBe('Back & Chest')
    expect(res.body.workout.exercises.map((e) => e.name)).toEqual(['Tempo Push-Up', 'Lat Pulldown'])
    workout = res.body.workout
  })

  it('refuses the same exercise twice, bad ids and unknown exercises', async () => {
    expect((await agent.post('/api/workouts/exercises').send({ exerciseId: byName('Tempo Push-Up').id, date: TODAY })).status).toBe(409)
    expect((await agent.post('/api/workouts/exercises').send({ exerciseId: 'abc', date: TODAY })).status).toBe(400)
    expect((await agent.post('/api/workouts/exercises').send({ exerciseId: 999999, date: TODAY })).status).toBe(404)
  })

  it('start marks it in progress', async () => {
    const res = await agent.post('/api/workouts/start').send({ workoutId: workout.id })
    expect(res.status).toBe(200)
    expect(res.body.workout.status).toBe('in_progress')
    expect(new Date(res.body.workout.startedAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
  })

  it('ticks and unticks a set', async () => {
    const setId = workout.exercises[0].sets[0].id
    let res = await agent.patch('/api/sets').send({ setId, completed: true })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ updated: 1, completed: true })
    let w = (await agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.exercises[0].sets[0].completed).toBe(true)

    res = await agent.patch('/api/sets').send({ setId, completed: false })
    expect(res.status).toBe(200)
    w = (await agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.exercises[0].sets[0].completed).toBe(false)
  })

  it('validates set updates', async () => {
    const setId = workout.exercises[0].sets[0].id
    expect((await agent.patch('/api/sets').send({ setId, completed: 'yes' })).status).toBe(400)
    expect((await agent.patch('/api/sets').send({ completed: true })).status).toBe(400)
    expect((await agent.patch('/api/sets').send({ setId: 999999, completed: true })).status).toBe(404)
    expect((await agent.post('/api/sets').send({ setId, completed: true })).status).toBe(405)
  })

  it('"mark all sets done" ticks every set of one exercise', async () => {
    const we = workout.exercises[1]
    const res = await agent.patch('/api/sets').send({ workoutExerciseId: we.id, completed: true })
    expect(res.status).toBe(200)
    expect(res.body.updated).toBe(we.sets.length)
  })

  it('restart clears every ticked set', async () => {
    const res = await agent.post('/api/workouts/start').send({ workoutId: workout.id, restart: true })
    expect(res.status).toBe(200)
    const w = (await agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.exercises.flatMap((e) => e.sets).some((s) => s.completed)).toBe(false)
  })

  it('completes the workout and saves its duration', async () => {
    for (const s of workout.exercises.flatMap((e) => e.sets)) {
      expect((await agent.patch('/api/sets').send({ setId: s.id, completed: true })).status).toBe(200)
    }
    const res = await agent.post('/api/workouts/finish').send({ workoutId: workout.id })
    expect(res.status).toBe(200)
    expect(res.body.workout.status).toBe('completed')
    expect(res.body.workout.durationMinutes).toBeGreaterThanOrEqual(1)
    expect(res.body.workout.completedAt).toBeTruthy()
  })

  it('finishing twice is harmless (returns the same completed workout)', async () => {
    const res = await agent.post('/api/workouts/finish').send({ workoutId: workout.id })
    expect(res.status).toBe(200)
    expect(res.body.workout.status).toBe('completed')
  })

  it('a completed workout is locked', async () => {
    const setId = workout.exercises[0].sets[0].id
    expect((await agent.patch('/api/sets').send({ setId, completed: false })).status).toBe(404)
    expect((await agent.post('/api/workouts/start').send({ workoutId: workout.id })).status).toBe(404)
  })

  it('adding an exercise after finishing starts a new workout for today', async () => {
    const res = await agent.post('/api/workouts/exercises').send({ exerciseId: byName('Jump Rope').id, date: TODAY })
    expect(res.status).toBe(201)
    expect(res.body.workout.id).not.toBe(workout.id)
    expect(res.body.workout.status).toBe('planned')
  })

  it('ticking the first set auto-starts a planned workout', async () => {
    const w = (await agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.status).toBe('planned')
    await agent.patch('/api/sets').send({ setId: w.exercises[0].sets[0].id, completed: true })
    const after = (await agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(after.status).toBe('in_progress')
    expect(after.startedAt).toBeTruthy()
  })
})

describe('SECURITY: users only ever see and change their own data', () => {
  let alice, bob, aliceWorkout

  beforeAll(async () => {
    alice = await t.signup({ fullName: 'Alice A' })
    bob = await t.signup({ fullName: 'Bob B' })
    const res = await alice.agent.post('/api/workouts/exercises').send({ exerciseId: byName('Back Squat').id, date: TODAY })
    aliceWorkout = res.body.workout
  })

  it("Bob cannot see Alice's workout", async () => {
    const res = await bob.agent.get(`/api/workouts?date=${TODAY}`)
    expect(res.status).toBe(200)
    expect(res.body.workout).toBeNull()
    const dash = await bob.agent.get(`/api/dashboard?date=${TODAY}`)
    expect(dash.body.today).toBeNull()
  })

  it("Bob cannot tick or untick Alice's sets", async () => {
    const setId = aliceWorkout.exercises[0].sets[0].id
    expect((await bob.agent.patch('/api/sets').send({ setId, completed: true })).status).toBe(404)
    expect((await bob.agent.patch('/api/sets').send({ workoutExerciseId: aliceWorkout.exercises[0].id, completed: true })).status).toBe(404)
  })

  it("Bob cannot start, restart or finish Alice's workout", async () => {
    expect((await bob.agent.post('/api/workouts/start').send({ workoutId: aliceWorkout.id })).status).toBe(404)
    expect((await bob.agent.post('/api/workouts/start').send({ workoutId: aliceWorkout.id, restart: true })).status).toBe(404)
    expect((await bob.agent.post('/api/workouts/finish').send({ workoutId: aliceWorkout.id })).status).toBe(404)
  })

  it("Alice's workout is untouched after Bob's attempts", async () => {
    const w = (await alice.agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.id).toBe(aliceWorkout.id)
    expect(w.status).toBe('planned')
    expect(w.exercises[0].sets.every((s) => !s.completed)).toBe(true)
  })

  it("Bob adding exercises never touches Alice's workout", async () => {
    const res = await bob.agent.post('/api/workouts/exercises').send({ exerciseId: byName('Back Squat').id, date: TODAY })
    expect(res.status).toBe(201)
    expect(res.body.workout.id).not.toBe(aliceWorkout.id)
    const w = (await alice.agent.get(`/api/workouts?date=${TODAY}`)).body.workout
    expect(w.exercises).toHaveLength(1)
  })
})
