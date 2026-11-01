import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Library,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Trophy,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ProgressRing from '../components/ProgressRing'
import GlassCard from '../components/GlassCard'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Skeleton, SkeletonCard } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { useAuth } from '../hooks/useAuth'
import { api, todayISO, useApi } from '../lib/api'

const PRESETS = [30, 60, 90, 120]

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function celebrate() {
  const colors = ['#C6FF3D', '#22E4F2', '#FFFFFF', '#FF7A3D']
  confetti({ particleCount: 160, spread: 100, startVelocity: 45, origin: { y: 0.6 }, colors })
  const end = Date.now() + 1800
  ;(function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors })
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

function useRingSize() {
  const calc = () => Math.max(200, Math.min(300, window.innerWidth - 96))
  const [size, setSize] = useState(calc)
  useEffect(() => {
    const on = () => setSize(calc())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return size
}

const setCompleted = (blocks, bi, si, value) =>
  blocks.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s, j) => (j === si ? { ...s, completed: value } : s)) }))

const setBlockCompleted = (blocks, bi, value) =>
  blocks.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s) => ({ ...s, completed: value })) }))

export default function LiveWorkout({ navigate }) {
  const { data, error, loading, reload } = useApi(`/api/workouts?date=${todayISO()}`)
  const workout = data?.workout

  return (
    <>
      {error ? (
        <>
          <PageHeader eyebrow="Live workout" title="Live workout" />
          <ErrorState error={error} onRetry={reload} />
        </>
      ) : loading ? (
        <LiveSkeleton />
      ) : !workout || workout.exercises.length === 0 ? (
        <>
          <PageHeader eyebrow="Live workout" title="Ready when you are" />
          <EmptyState
            icon={Dumbbell}
            title="No workout yet today"
            message="Pick a few exercises from the Library and they’ll be waiting for you here."
            action="Open the Library"
            onAction={() => navigate('library')}
          />
        </>
      ) : workout.status === 'completed' ? (
        <CompletedToday workout={workout} navigate={navigate} />
      ) : (
        <Session key={workout.id} workout={workout} navigate={navigate} />
      )}
    </>
  )
}

function Session({ workout, navigate }) {
  const toast = useToast()
  const { refresh: refreshUser } = useAuth()
  const ringSize = useRingSize()
  const [blocks, setBlocks] = useState(workout.exercises)
  const [current, setCurrent] = useState(() => {
    const i = workout.exercises.findIndex((b) => b.sets.some((s) => !s.completed))
    return i === -1 ? 0 : i
  })
  const [rest, setRest] = useState(null) // { total, endAt, pausedRemaining }
  const [startedAt, setStartedAt] = useState(() => (workout.startedAt ? new Date(workout.startedAt).getTime() : null))
  const [now, setNow] = useState(() => Date.now())
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])

  const totalSets = blocks.reduce((n, b) => n + b.sets.length, 0)
  const doneSets = blocks.reduce((n, b) => n + b.sets.filter((s) => s.completed).length, 0)
  const allDone = doneSets === totalSets
  // Clamp: `now` ticks every 200ms, so it can briefly lag behind a freshly started timer
  const remaining = rest ? (rest.pausedRemaining ?? Math.min(rest.total, Math.max(0, rest.endAt - now))) : 0
  const resting = !!rest && rest.pausedRemaining == null

  // Rest finished
  useEffect(() => {
    if (resting && remaining <= 0) {
      setRest(null)
      navigator.vibrate?.([120, 60, 120])
      toast({ type: 'info', title: 'Rest over — let’s go!', message: 'Next set is up. You’ve got this.' })
    }
  }, [resting, remaining, toast])

  const startRest = useCallback((seconds) => {
    setRest({ total: seconds * 1000, endAt: Date.now() + seconds * 1000, pausedRemaining: null })
  }, [])

  const finish = useCallback(async () => {
    setFinishing(true)
    setRest(null)
    try {
      const data = await api('/api/workouts/finish', { method: 'POST', body: { workoutId: workout.id } })
      setFinished({ minutes: data.workout.durationMinutes })
      setTimeout(celebrate, 150)
      refreshUser()
    } catch (err) {
      toast({ type: 'error', title: 'Couldn’t save your workout', message: `${err.message} Your sets are safe — tap “Finish workout” to try again.` })
    } finally {
      setFinishing(false)
    }
  }, [workout.id, toast, refreshUser])

  // Saves in the background; the UI has already updated (optimistic). Rolls back on failure.
  // Each save resolves true/false; finishing waits for every in-flight save first.
  const inflight = useRef(new Set())
  const save = (body, rollback) => {
    const p = api('/api/sets', { method: 'PATCH', body }).then(
      () => true,
      (err) => {
        setBlocks(rollback)
        toast({ type: 'error', title: 'That tick didn’t save', message: err.message })
        return false
      },
    )
    inflight.current.add(p)
    p.finally(() => inflight.current.delete(p))
    return p
  }
  const finishAfterSaves = () => {
    setFinishing(true)
    Promise.all([...inflight.current]).then((results) => (results.every(Boolean) ? finish() : setFinishing(false)))
  }

  const toggleSet = (bi, si) => {
    const set = blocks[bi].sets[si]
    const value = !set.completed
    const next = setCompleted(blocks, bi, si, value)
    setBlocks(next)
    if (value && !startedAt) setStartedAt(Date.now())
    save({ setId: set.id, completed: value }, (cur) => setCompleted(cur, bi, si, !value))
    if (!value) return

    if (next.every((b) => b.sets.every((s) => s.completed))) return finishAfterSaves()

    startRest(blocks[bi].restSeconds)
    if (next[bi].sets.every((s) => s.completed)) {
      const upcoming = next.findIndex((b, i) => i > bi && b.sets.some((s) => !s.completed))
      const fallback = next.findIndex((b) => b.sets.some((s) => !s.completed))
      setTimeout(() => setCurrent(upcoming !== -1 ? upcoming : fallback), 350)
      toast({ title: `${blocks[bi].name} done 💪`, message: 'Moving on to the next exercise.' })
    }
  }

  const completeBlock = (bi) => {
    const before = blocks[bi].sets.map((s) => s.completed)
    const next = setBlockCompleted(blocks, bi, true)
    setBlocks(next)
    if (!startedAt) setStartedAt(Date.now())
    save({ workoutExerciseId: blocks[bi].id, completed: true }, (cur) =>
      cur.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s, j) => ({ ...s, completed: before[j] })) })),
    )
    if (next.every((b) => b.sets.every((s) => s.completed))) return finishAfterSaves()
    setCurrent(next.findIndex((b) => b.sets.some((s) => !s.completed)))
  }

  const togglePause = () => {
    if (!rest) return
    if (rest.pausedRemaining != null) setRest({ ...rest, endAt: Date.now() + rest.pausedRemaining, pausedRemaining: null })
    else setRest({ ...rest, pausedRemaining: remaining })
  }

  const adjust = (delta) => {
    if (!rest) return startRest(Math.max(delta, 15))
    if (rest.pausedRemaining != null) {
      const r = Math.max(1000, rest.pausedRemaining + delta * 1000)
      setRest({ ...rest, pausedRemaining: r, total: Math.max(rest.total, r) })
    } else {
      const endAt = Math.max(Date.now() + 1000, rest.endAt + delta * 1000)
      setRest({ ...rest, endAt, total: Math.max(rest.total, endAt - Date.now()) })
    }
  }

  const restart = async () => {
    const previous = blocks
    setBlocks(blocks.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s, completed: false })) })))
    setCurrent(0)
    setRest(null)
    setStartedAt(Date.now())
    try {
      await api('/api/workouts/start', { method: 'POST', body: { workoutId: workout.id, restart: true } })
      toast({ type: 'info', title: 'Fresh start', message: 'All sets cleared and the clock is reset.' })
    } catch (err) {
      setBlocks(previous)
      toast({ type: 'error', title: 'Couldn’t restart', message: err.message })
    }
  }

  const ringValue = rest ? remaining / rest.total : 1
  const ringColor = rest && remaining <= 5000 ? '#FF7A3D' : '#C6FF3D'
  const nextUp = useMemo(() => {
    for (let bi = 0; bi < blocks.length; bi++) {
      const si = blocks[bi].sets.findIndex((s) => !s.completed)
      if (si !== -1) return { bi, si, block: blocks[bi] }
    }
    return null
  }, [blocks])

  return (
    <>
      <PageHeader eyebrow="Live workout" title={workout.name} subtitle={[...new Set(blocks.map((b) => b.muscleGroup))].join(' · ')}>
        <div className="flex items-center gap-2">
          <span className="chip border border-line/10 bg-line/[0.04] !px-3.5 !py-2 text-sm text-ink">
            <span className={`h-2 w-2 rounded-full ${startedAt ? 'animate-pulse bg-ember' : 'bg-muted'}`} />
            <span className="tabular-nums">{startedAt ? fmt(now - startedAt) : '00:00'}</span>
          </span>
          <button onClick={restart} className="btn-ghost !py-2 text-sm" aria-label="Restart workout">
            <RotateCcw className="h-4 w-4" /> Restart
          </button>
        </div>
      </PageHeader>

      {/* Overall progress */}
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted">
            <span className="font-semibold text-ink">{doneSets}</span> of {totalSets} sets
          </span>
          <span className="font-semibold text-accent">{Math.round((doneSets / totalSets) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line/[0.07]">
          <motion.div
            className="h-full rounded-full bg-gradient-brand shadow-glow"
            animate={{ width: `${(doneSets / totalSets) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Timer */}
        <GlassCard className="flex flex-col items-center p-6 sm:p-8 lg:sticky lg:top-6 lg:self-start">
          <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex w-full items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" /> Rest timer
            </span>
            <span className={`chip ${rest ? (resting ? 'bg-accent/15 text-accent' : 'bg-line/10 text-muted') : 'bg-line/[0.06] text-muted'}`}>
              {rest ? (resting ? 'Resting' : 'Paused') : 'Ready'}
            </span>
          </div>

          <div className="relative mt-6">
            <ProgressRing value={ringValue} size={ringSize} stroke={16} color={ringColor} transition={{ duration: 0.25, ease: 'linear' }}>
              <div>
                <motion.p
                  key={rest ? 'r' : 'i'}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  role="timer"
                  aria-label={rest ? `Rest time remaining ${fmt(remaining)}` : 'Ready for the next set'}
                  className="font-display text-6xl font-bold tabular-nums tracking-tight sm:text-7xl"
                >
                  {rest ? fmt(remaining) : 'GO'}
                </motion.p>
                <p className="mt-1 max-w-[180px] text-sm text-muted">
                  {rest ? 'Breathe. Next set loading…' : nextUp ? `${nextUp.block.name} · Set ${nextUp.si + 1}` : 'All sets done!'}
                </p>
              </div>
            </ProgressRing>
          </div>

          <div className="relative mt-8 flex items-center gap-3">
            <button onClick={() => adjust(-15)} disabled={!rest} className="btn-ghost h-12 w-14 !px-0 text-sm font-semibold disabled:opacity-40">
              −15
            </button>
            <button
              onClick={rest ? togglePause : () => startRest(nextUp?.block.restSeconds ?? 60)}
              className="btn-primary h-16 w-16 !rounded-full !p-0"
              aria-label={rest ? (resting ? 'Pause timer' : 'Resume timer') : 'Start rest timer'}
            >
              {resting ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
            </button>
            <button onClick={() => adjust(15)} className="btn-ghost h-12 w-14 !px-0 text-sm font-semibold">
              +15
            </button>
            <button onClick={() => setRest(null)} disabled={!rest} className="btn-ghost h-12 w-12 !px-0 disabled:opacity-40" aria-label="Skip rest">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-5 flex gap-2">
            {PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => startRest(s)}
                className="rounded-full border border-line/10 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
              >
                {s}s
              </button>
            ))}
          </div>
        </GlassCard>

        {/* Exercises */}
        <div className="flex flex-col gap-3">
          {blocks.map((b, bi) => {
            const open = bi === current
            const count = b.sets.filter((s) => s.completed).length
            const complete = count === b.sets.length
            return (
              <GlassCard key={b.id} className={`!rounded-2xl transition-shadow ${open ? 'shadow-glow' : ''}`}>
                <button onClick={() => setCurrent(open ? -1 : bi)} className="flex w-full items-center gap-4 p-4 text-left sm:p-5" aria-expanded={open}>
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${
                      complete ? 'bg-gradient-brand text-[#0A0D10]' : 'bg-line/[0.05] text-accent ring-1 ring-line/10'
                    }`}
                  >
                    {complete ? <Check className="h-5 w-5" strokeWidth={3} /> : <Dumbbell className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-display font-semibold ${complete ? 'text-muted line-through decoration-accent/60' : ''}`}>{b.name}</p>
                    <p className="text-sm text-muted">
                      {count}/{b.sets.length} sets · {b.restSeconds}s rest
                    </p>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                        {b.sets.map((set, si) => (
                          <motion.button
                            key={set.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggleSet(bi, si)}
                            disabled={finishing}
                            className={`flex w-full items-center gap-4 rounded-2xl border p-3.5 text-left transition-colors ${
                              set.completed ? 'border-accent/30 bg-accent/10' : 'border-line/10 bg-line/[0.03] hover:border-line/20'
                            }`}
                            aria-pressed={set.completed}
                          >
                            <span className="w-12 text-xs font-semibold uppercase tracking-wider text-muted">Set {set.setNumber}</span>
                            <span className="flex-1 font-display text-lg font-semibold tabular-nums">
                              {b.reps} <span className="text-sm font-normal text-muted">{/^\d+([–-]\d+)?$/.test(b.reps) ? 'reps' : ''}</span>
                            </span>
                            <span
                              className={`grid h-9 w-9 place-items-center rounded-xl transition-all ${
                                set.completed ? 'bg-gradient-brand text-[#0A0D10] shadow-glow' : 'border-2 border-line/15'
                              }`}
                            >
                              <AnimatePresence>
                                {set.completed && (
                                  <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                                    <Check className="h-5 w-5" strokeWidth={3} />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </span>
                          </motion.button>
                        ))}
                        {!complete && (
                          <button onClick={() => completeBlock(bi)} className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-muted hover:text-accent">
                            <CheckCheck className="h-3.5 w-3.5" /> Mark all sets done
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            )
          })}

          {(allDone || finishing) && !finished && (
            <button onClick={finish} disabled={finishing} className="btn-primary !py-4">
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              {finishing ? 'Saving your workout…' : 'Finish workout'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {finished && (
          <CompleteModal
            minutes={finished.minutes}
            totalSets={totalSets}
            exercises={blocks.length}
            onLibrary={() => navigate('library')}
            onDone={() => navigate('dashboard')}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function CompletedToday({ workout, navigate }) {
  const sets = workout.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <>
      <PageHeader eyebrow="Live workout" title={workout.name} subtitle="Today’s session is in the books." />
      <GlassCard className="flex flex-col items-center px-6 py-12 text-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-brand shadow-glow">
          <Trophy className="h-10 w-10 text-[#0A0D10]" />
        </div>
        <h2 className="relative mt-6 text-3xl font-bold">
          Workout <span className="text-gradient">complete.</span>
        </h2>
        <p className="relative mt-2 max-w-md text-muted">
          {workout.durationMinutes} min · {workout.exercises.length} exercises · {sets} sets. Want to go again? Add more moves from the Library to start a new session.
        </p>
        <div className="relative mt-7 flex flex-col gap-2 sm:flex-row">
          <button onClick={() => navigate('library')} className="btn-ghost">
            <Library className="h-4 w-4" /> Add another workout
          </button>
          <button onClick={() => navigate('dashboard')} className="btn-primary">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </GlassCard>
    </>
  )
}

function LiveSkeleton() {
  return (
    <>
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-56" />
      <Skeleton className="mb-6 h-2 w-full" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <SkeletonCard className="flex flex-col items-center !p-8">
          <Skeleton className="h-[260px] w-[260px] !rounded-full" />
          <Skeleton className="mt-8 h-14 w-60" />
        </SkeletonCard>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="!rounded-2xl !p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-11 w-11" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-24" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </>
  )
}

function CompleteModal({ minutes, totalSets, exercises, onLibrary, onDone }) {
  const { user } = useAuth()
  return (
    <motion.div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-title"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="glass relative w-full max-w-md overflow-hidden p-8 text-center"
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" />
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
          className="relative mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-brand shadow-glow"
        >
          <Trophy className="h-10 w-10 text-[#0A0D10]" />
        </motion.div>
        <h2 id="complete-title" className="relative mt-6 text-3xl font-bold">
          Workout <span className="text-gradient">crushed!</span>
        </h2>
        <p className="relative mt-2 text-muted">
          {user?.streak > 1 ? `Streak extended to ${user.streak} days.` : 'Day one of your streak.'} That’s how champions are built.
        </p>

        <div className="relative mt-6 grid grid-cols-3 gap-2">
          {[
            { icon: Clock, v: `${minutes} min`, k: 'Time' },
            { icon: Dumbbell, v: exercises, k: 'Exercises' },
            { icon: Flame, v: totalSets, k: 'Sets' },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl bg-line/[0.05] py-3">
              <s.icon className="mx-auto h-4 w-4 text-accent" />
              <p className="mt-1 font-display text-lg font-bold tabular-nums">{s.v}</p>
              <p className="text-[11px] text-muted">{s.k}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-7 flex flex-col gap-2 sm:flex-row">
          <button onClick={onLibrary} className="btn-ghost flex-1">
            <Library className="h-4 w-4" /> Library
          </button>
          <button onClick={onDone} className="btn-primary flex-1">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
