import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ArrowRight, Calendar, CalendarPlus, Check, CircleCheck, Clock, Dumbbell, Flame, Library, Play, Zap } from 'lucide-react'
import GlassCard from '../components/GlassCard'
import PageHeader from '../components/PageHeader'
import ProgressRing from '../components/ProgressRing'
import AnimatedCounter from '../components/AnimatedCounter'
import QuoteCard from '../components/QuoteCard'
import ErrorState from '../components/ErrorState'
import { Skeleton, SkeletonCard } from '../components/Skeleton'
import { useChartColors } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { todayISO, useApi } from '../lib/api'
import { estimateMinutes } from '../lib/workout'
import { weekRings } from '../lib/rings'
import { classTypes, classes } from '../data/mock'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function motivation(week) {
  const left = week.goalWorkouts - week.workouts
  if (week.workouts === 0) return 'A fresh week. Your first workout sets the tone — let’s go.'
  if (left > 1) return `${left} more workouts to hit this week's goal. You've got this.`
  if (left === 1) return "You're 1 workout away from smashing this week's goal. Let's go."
  return 'Weekly goal smashed. Everything from here is bonus gains. 🔥'
}

export default function Dashboard({ navigate, bookings }) {
  const { user } = useAuth()
  const { data, error, loading, reload } = useApi(`/api/dashboard?date=${todayISO()}`)
  const nextClass = classes.find((c) => bookings.has(c.id))
  const firstName = user.fullName.split(' ')[0]

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        title={
          <>
            {greeting()}, <span className="text-gradient">{firstName}</span>
          </>
        }
        subtitle={data ? motivation(data.week) : 'Here’s where your training stands today.'}
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <TodayCard workout={data.today} navigate={navigate} />
          <StreakCard streak={data.streak} activity={data.activity} />

          <GlassCard className="p-6 lg:col-span-2">
            <WeeklyChart activity={data.activity} previous={data.previousWeekMinutes} />
          </GlassCard>

          <RingsCard week={data.week} />

          <QuoteCard className="lg:col-span-2" />

          {/* Next class */}
          <GlassCard className="p-6">
            <span className="label">Next class</span>
            {nextClass ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl text-xl"
                    style={{ backgroundColor: `${classTypes[nextClass.type].color}22` }}
                  >
                    {classTypes[nextClass.type].emoji}
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold">{nextClass.name}</p>
                    <p className="text-sm text-muted">
                      {nextClass.day} · {nextClass.time} · {nextClass.coach}
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate('classes')} className="btn-ghost mt-5 w-full">
                  <Calendar className="h-4 w-4" /> View schedule
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-line/15 px-4 py-6 text-center">
                <CalendarPlus className="h-7 w-7 text-accent" />
                <p className="mt-3 font-semibold">No classes booked yet</p>
                <p className="mt-1 text-sm text-muted">Grab a spot in HIIT, Yoga, Spin or Boxing.</p>
                <button onClick={() => navigate('classes')} className="btn-ghost mt-4 !py-2 text-sm">
                  Browse classes
                </button>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </>
  )
}

function TodayCard({ workout, navigate }) {
  const totalSets = workout?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0
  const doneSets = workout?.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0) ?? 0
  const minutes = workout ? estimateMinutes(workout) : 0
  const completed = workout?.status === 'completed'

  return (
    <GlassCard className="p-0 lg:col-span-2">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-accent2/20 blur-3xl" />
      {!workout || workout.exercises.length === 0 ? (
        <div className="relative flex h-full flex-col items-start justify-center gap-4 p-6 sm:p-7">
          <span className="chip bg-accent/15 text-accent">
            <Zap className="h-3.5 w-3.5" /> Today's workout
          </span>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">No workout yet today.</h2>
            <p className="mt-1 text-muted">Pick a few moves from the Library and they’ll show up right here.</p>
          </div>
          <button onClick={() => navigate('library')} className="btn-primary group">
            <Library className="h-4 w-4" /> Open the Library
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      ) : (
        <div className="relative flex h-full flex-col gap-6 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`chip ${completed ? 'bg-accent2/15 text-accent2' : 'bg-accent/15 text-accent'}`}>
                {completed ? <CircleCheck className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                {completed ? 'Completed today' : workout.status === 'in_progress' ? 'In progress' : "Today's workout"}
              </span>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl">{workout.name}</h2>
              <p className="mt-1 text-muted">
                {[...new Set(workout.exercises.map((e) => e.muscleGroup))].join(' · ')}
              </p>
            </div>
            <div className="hidden h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-brand shadow-glow sm:grid">
              {completed ? <Check className="h-8 w-8 text-[#0A0D10]" strokeWidth={3} /> : <Dumbbell className="h-8 w-8 text-[#0A0D10]" />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {workout.exercises.map((e) => (
              <span key={e.id} className="rounded-xl bg-line/[0.05] px-3 py-1.5 text-sm">
                {e.name} <span className="text-muted">· {e.sets.length}×</span>
              </span>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-6 text-sm">
              <Stat icon={Clock} label={completed ? 'Duration' : 'Est. time'} value={`${completed ? workout.durationMinutes : minutes} min`} />
              <Stat icon={Flame} label="Burn" value={`~${(completed ? workout.durationMinutes : minutes) * 8} kcal`} />
              <Stat icon={Dumbbell} label="Sets" value={completed ? totalSets : `${doneSets}/${totalSets}`} />
            </div>
            {completed ? (
              <button onClick={() => navigate('library')} className="btn-ghost">
                <Library className="h-4 w-4" /> Add another workout
              </button>
            ) : (
              <button onClick={() => navigate('live')} className="btn-primary group">
                <Play className="h-4 w-4 fill-current" /> {workout.status === 'in_progress' ? 'Resume' : 'Start'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  )
}

function StreakCard({ streak, activity }) {
  return (
    <GlassCard className="flex flex-col p-6">
      <div className="flex items-center justify-between">
        <span className="label">Streak</span>
        <span className="text-xs text-muted">Best {streak.best} {streak.best === 1 ? 'day' : 'days'}</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-full bg-ember/40 blur-xl"
            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          />
          <motion.div
            animate={{ rotate: [-4, 4, -4], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#FFB23D] to-ember"
          >
            <Flame className="h-9 w-9 fill-white/30 text-white" />
          </motion.div>
        </div>
        <div>
          <p className="font-display text-5xl font-bold leading-none">
            <AnimatedCounter value={streak.current} duration={1.2} />
          </p>
          <p className="mt-1 text-sm text-muted">{streak.current === 1 ? 'day in a row' : 'days in a row'}</p>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-7 gap-1.5 pt-6">
        {activity.map((d, i) => {
          const done = d.minutes > 0
          const today = i === activity.length - 1
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5" title={`${d.day}: ${d.minutes} min`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05, type: 'spring' }}
                className={`h-8 w-full rounded-lg ${done ? 'bg-gradient-to-t from-ember to-[#FFB23D]' : 'bg-line/[0.06]'} ${
                  today ? 'ring-2 ring-accent ring-offset-2 ring-offset-transparent' : ''
                }`}
              />
              <span className={`text-[10px] font-medium ${today ? 'text-ink' : 'text-muted'}`}>{d.day[0]}</span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

function RingsCard({ week }) {
  const { rings, percent: pct } = weekRings(week)

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between">
        <span className="label">This week</span>
        <span className="text-xs text-muted">Goal progress</span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {rings.map((r, i) => (
          <div key={r.key} className="flex flex-col items-center">
            <ProgressRing value={r.progress} size={88} stroke={9} color={r.color} delay={0.2 + i * 0.15}>
              <span className="font-display text-lg font-bold tabular-nums">
                <AnimatedCounter value={r.value} duration={1.4} />
              </span>
            </ProgressRing>
            <p className="mt-2 text-xs font-semibold">{r.label}</p>
            <p className="text-[11px] text-muted">
              of {r.goal}
              {r.unit && ` ${r.unit}`}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-line/[0.04] p-3 text-sm">
        <span className="font-semibold text-accent">{pct}%</span>
        <span className="text-muted">
          {pct >= 100 ? ' of your weekly target. Both goals hit — legendary.' : ' of your weekly target. Keep stacking sessions.'}
        </span>
      </div>
    </GlassCard>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SkeletonCard className="h-64 lg:col-span-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-5 h-10 w-56" />
        <Skeleton className="mt-3 h-4 w-40" />
        <div className="mt-8 flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </SkeletonCard>
      <SkeletonCard className="h-64">
        <Skeleton className="h-4 w-20" />
        <div className="mt-5 flex items-center gap-4">
          <Skeleton className="h-16 w-16 !rounded-2xl" />
          <Skeleton className="h-12 w-20" />
        </div>
        <Skeleton className="mt-12 h-8 w-full" />
      </SkeletonCard>
      <SkeletonCard className="h-80 lg:col-span-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-6 h-48 w-full" />
      </SkeletonCard>
      <SkeletonCard className="h-80">
        <Skeleton className="h-4 w-24" />
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mx-auto h-[88px] w-[88px] !rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-8 h-12 w-full" />
      </SkeletonCard>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-0.5 font-display font-semibold">{value}</p>
    </div>
  )
}

function WeeklyChart({ activity, previous }) {
  const c = useChartColors()
  const total = useMemo(() => activity.reduce((n, d) => n + d.minutes, 0), [activity])
  const change = previous > 0 ? Math.round(((total - previous) / previous) * 100) : null
  const todayIdx = activity.length - 1

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Last 7 days</span>
          <p className="mt-2 font-display text-3xl font-bold">
            <AnimatedCounter value={total} /> <span className="text-base font-medium text-muted">active min</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold">
            ~<AnimatedCounter value={total * 8} /> <span className="text-sm font-medium text-muted">kcal</span>
          </p>
          {change !== null ? (
            <p className={`text-xs ${change >= 0 ? 'text-accent' : 'text-ember'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change)}% vs previous 7 days
            </p>
          ) : (
            <p className="text-xs text-muted">Your first week of data</p>
          )}
        </div>
      </div>
      <div className="relative mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.lime} />
                <stop offset="100%" stopColor={c.cyan} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: c.tick, fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: c.tick, fontSize: 12 }} allowDecimals={false} tickCount={4} domain={[0, (max) => Math.max(30, Math.ceil(max / 30) * 30)]} />
            <Tooltip cursor={{ fill: c.grid, radius: 12 }} content={<ChartTooltip colors={c} />} />
            <Bar dataKey="minutes" radius={[10, 10, 4, 4]} maxBarSize={36} animationDuration={1200} animationEasing="ease-out">
              {activity.map((d, i) => (
                <Cell key={d.date} fill="url(#bar-grad)" fillOpacity={i === todayIdx ? 1 : 0.55} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {total === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">
            Finish a workout and your bars start growing here 📈
          </p>
        )}
      </div>
    </>
  )
}

function ChartTooltip({ active, payload, colors }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm shadow-xl backdrop-blur"
      style={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, color: colors.ink }}
    >
      <p className="font-display font-semibold">
        {d.day} · {new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </p>
      {d.minutes ? <p className="text-muted">{d.minutes} active min</p> : <p className="text-muted">Rest day 😴</p>}
    </div>
  )
}
