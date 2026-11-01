import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Dumbbell, Loader2, Play, Plus, Search, SearchX, Timer, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Skeleton, SkeletonCard } from '../components/Skeleton'
import { fadeUp } from '../components/motion'
import { useToast } from '../components/Toast'
import { api, todayISO, useApi } from '../lib/api'
import { MUSCLE_GROUPS } from '../lib/workout'

const difficultyStyle = {
  Beginner: { cls: 'bg-accent2/10 text-accent2', bars: 1 },
  Intermediate: { cls: 'bg-[#FFC53D]/15 text-[#8a6200] dark:text-[#FFC53D]', bars: 2 },
  Advanced: { cls: 'bg-ember/15 text-ember', bars: 3 },
}

export default function Library({ navigate }) {
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(null)
  const toast = useToast()
  const exercisesReq = useApi('/api/exercises')
  const todayReq = useApi(`/api/workouts?date=${todayISO()}`)

  const exercises = exercisesReq.data?.exercises ?? []
  const today = todayReq.data?.workout
  // Only an open workout counts as "today's" for adding; a finished one starts fresh
  const addedIds = useMemo(
    () => new Set(today && today.status !== 'completed' ? today.exercises.map((e) => e.exerciseId) : []),
    [today],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        (group === 'All' || e.muscleGroup === group) &&
        (!q || e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)),
    )
  }, [exercises, group, query])

  const reset = () => {
    setGroup('All')
    setQuery('')
  }

  const add = async (exercise) => {
    setPending(exercise.id)
    try {
      const data = await api('/api/workouts/exercises', { method: 'POST', body: { exerciseId: exercise.id, date: todayISO() } })
      todayReq.setData({ workout: data.workout })
      toast({ title: 'Added to today’s workout', message: `${exercise.name} · ${exercise.sets} × ${exercise.reps}` })
    } catch (err) {
      toast({ type: err.status === 409 ? 'info' : 'error', title: err.status === 409 ? 'Already on the list' : 'Couldn’t add that one', message: err.message })
    } finally {
      setPending(null)
    }
  }

  const openCount = addedIds.size

  return (
    <>
      <PageHeader
        eyebrow="Workout library"
        title="Find your next move"
        subtitle={
          exercisesReq.data
            ? `${exercises.length} coach-approved exercises. Filter by muscle group and add them to today's workout.`
            : 'Coach-approved exercises, filtered by muscle group.'
        }
      >
        <AnimatePresence>
          {openCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => navigate('live')}
              className="btn-primary self-start"
            >
              <Play className="h-4 w-4 fill-current" /> Start workout · {openCount}
            </motion.button>
          )}
        </AnimatePresence>
      </PageHeader>

      <motion.div variants={fadeUp} className="sticky top-16 z-20 -mx-4 mb-6 bg-bg/80 px-4 py-3 backdrop-blur-xl lg:top-0 lg:mx-0 lg:rounded-2xl lg:px-0">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="h-12 w-full rounded-2xl border border-line/10 bg-line/[0.04] pl-11 pr-10 text-sm outline-none transition placeholder:text-muted focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
            aria-label="Search exercises"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Muscle group">
          {MUSCLE_GROUPS.map((g) => {
            const active = g === group
            const count = g === 'All' ? exercises.length : exercises.filter((e) => e.muscleGroup === g).length
            return (
              <button
                key={g}
                role="tab"
                aria-selected={active}
                onClick={() => setGroup(g)}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? 'text-[#0A0D10]' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span layoutId="group-pill" className="absolute inset-0 rounded-full bg-gradient-brand shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                )}
                {!active && <span className="absolute inset-0 rounded-full border border-line/10" />}
                <span className="relative">
                  {g} {exercisesReq.data && <span className={active ? 'opacity-60' : 'opacity-50'}>{count}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {exercisesReq.error ? (
        <ErrorState error={exercisesReq.error} onRetry={exercisesReq.reload} />
      ) : exercisesReq.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="!p-5">
              <div className="flex justify-between">
                <Skeleton className="h-12 w-12 !rounded-2xl" />
                <Skeleton className="h-6 w-24 !rounded-full" />
              </div>
              <Skeleton className="mt-5 h-3 w-14" />
              <Skeleton className="mt-2 h-5 w-44" />
              <Skeleton className="mt-2 h-4 w-full" />
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
              <Skeleton className="mt-5 h-10 w-full" />
            </SkeletonCard>
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState icon={Dumbbell} title="The library is empty" message="No exercises in the database yet. Run “npm run db:setup” to load the starter library." />
      ) : list.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No moves match that"
          message={`We couldn't find anything${query ? ` for “${query}”` : ''}${group !== 'All' ? ` in ${group}` : ''}. Try another word or clear the filters.`}
          action="Clear filters"
          onAction={reset}
        />
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((e) => (
              <ExerciseCard key={e.id} exercise={e} added={addedIds.has(e.id)} pending={pending === e.id} onAdd={() => add(e)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  )
}

// forwardRef: AnimatePresence's popLayout mode measures each card through a ref
const ExerciseCard = forwardRef(function ExerciseCard({ exercise: e, added, pending, onAdd }, ref) {
  const d = difficultyStyle[e.difficulty]
  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`glass group flex flex-col p-5 transition-shadow hover:shadow-glow ${added ? 'ring-1 ring-accent/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-line/[0.05] ring-1 ring-line/10 transition group-hover:bg-accent/15 group-hover:ring-accent/30">
          <Dumbbell className="h-5 w-5 text-accent" />
        </div>
        <span className={`chip ${d.cls}`}>
          <span className="flex gap-0.5">
            {[1, 2, 3].map((i) => (
              <span key={i} className={`h-2.5 w-1 rounded-full ${i <= d.bars ? 'bg-current' : 'bg-current opacity-25'}`} />
            ))}
          </span>
          {e.difficulty}
        </span>
      </div>

      <p className="label mt-4">{e.muscleGroup}</p>
      <h3 className="mt-1 text-lg font-semibold leading-snug">{e.name}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{e.description}</p>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Metric value={e.sets} label="Sets" />
        <Metric value={e.reps} label="Reps" />
        <Metric value={`${e.restSeconds}s`} label="Rest" />
      </div>

      <div className="mt-auto pt-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
          <Timer className="h-3.5 w-3.5" /> ~{Math.round((e.sets * (45 + e.restSeconds)) / 60)} min with rests
        </p>
        <button
          onClick={onAdd}
          disabled={pending || added}
          className={`w-full !rounded-xl !py-2.5 text-sm ${added ? 'btn-ghost !border-accent/40 !text-accent !opacity-100' : 'btn-ghost hover:!border-accent/40 hover:!text-accent'}`}
        >
          {pending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
          ) : added ? (
            <><Check className="h-4 w-4" strokeWidth={3} /> In today’s workout</>
          ) : (
            <><Plus className="h-4 w-4" /> Add to today’s workout</>
          )}
        </button>
      </div>
    </motion.article>
  )
})

function Metric({ value, label }) {
  return (
    <div className="rounded-xl bg-line/[0.04] py-2.5">
      <p className="font-display font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  )
}
