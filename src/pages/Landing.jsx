import { motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import AnimatedCounter from '../components/AnimatedCounter'
import ProgressRing from '../components/ProgressRing'
import Footer from '../components/Footer'
import { quoteOfTheDay } from '../components/QuoteCard'
import { ease, fadeUp, stagger } from '../components/motion'
import { Skeleton } from '../components/Skeleton'
import { useApi } from '../lib/api'
import { initialsOf, useAuth } from '../hooks/useAuth'
import { user as heroMock } from '../data/mock'

const features = [
  { icon: Dumbbell, title: 'Plan workouts', text: 'A 20+ move library filtered by muscle group, with sets, reps and difficulty dialled in.', to: 'library', color: 'text-accent', bg: 'bg-accent/10' },
  { icon: Timer, title: 'Train live', text: 'A big, thumb-friendly rest timer. Tick off sets and hear the crowd when you finish.', to: 'live', color: 'text-accent2', bg: 'bg-accent2/10' },
  { icon: TrendingUp, title: 'See progress', text: 'Strength curves, personal records and trophy badges that make gains impossible to miss.', to: 'progress', color: 'text-ember', bg: 'bg-ember/10' },
  { icon: Calendar, title: 'Book classes', text: 'Yoga, HIIT, Spin and Boxing. See spots left and lock in your place in one tap.', to: 'classes', color: 'text-violet', bg: 'bg-violet/10' },
]

export default function Landing({ navigate, onLogout }) {
  const quote = quoteOfTheDay()
  const { user } = useAuth()
  const stats = useApi('/api/stats')
  const startWorkout = () => navigate(user ? 'dashboard' : 'signup')
  const heroStats = [
    { label: 'Members', value: stats.data?.members },
    { label: 'Workouts completed', value: stats.data?.workoutsCompleted },
    { label: 'Classes this week', value: stats.data?.classesThisWeek },
  ]

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-line/[0.06] bg-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo onClick={() => navigate('home')} />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
            <button onClick={() => navigate('library')} className="transition hover:text-ink">Workouts</button>
            <button onClick={() => navigate('classes')} className="transition hover:text-ink">Classes</button>
            <button onClick={() => navigate('progress')} className="transition hover:text-ink">Progress</button>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <button onClick={() => navigate('dashboard')} className="btn-ghost !py-2 !pl-2 !pr-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-brand font-display text-xs font-bold text-[#0A0D10]">
                    {initialsOf(user.fullName)}
                  </span>
                  <span className="hidden max-w-[140px] truncate sm:inline">{user.fullName}</span>
                </button>
                <button onClick={onLogout} className="btn-ghost !py-2 text-sm">
                  Log out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('login')} className="btn-ghost !py-2 text-sm">
                  Log in
                </button>
                <button onClick={() => navigate('signup')} className="btn-primary hidden !py-2 text-sm sm:inline-flex">
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <HeroPulseLine />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={fadeUp} className="chip mb-6 border border-accent/30 bg-accent/10 text-accent">
              <Sparkles className="h-3.5 w-3.5" /> PulseFit · Season 2026
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-[44px] font-bold leading-[0.95] tracking-[-0.045em] sm:text-7xl lg:text-[84px]"
            >
              Train smarter.
              <br />
              <span className="text-gradient">Get stronger.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 max-w-lg text-lg text-muted">
              PulseFit is the gym app that plans your sessions, times your rests, books your classes and keeps
              the streak alive. Everything you need, in your pocket.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={startWorkout} className="btn-primary group !px-7 !py-4 text-base">
                <Play className="h-4 w-4 fill-current" />
                Start Your Workout
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button onClick={() => navigate('dashboard')} className="btn-ghost !px-6 !py-4 text-base">
                Explore dashboard
              </button>
            </motion.div>

            {/* Stats */}
            <motion.dl variants={fadeUp} className="mt-12 grid grid-cols-3 gap-3 sm:gap-6">
              {heroStats.map((s) => (
                <div key={s.label} className="border-l border-line/10 pl-3 sm:pl-4">
                  <dd className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
                    {stats.loading ? (
                      <Skeleton className="h-8 w-16 sm:h-10 sm:w-24" />
                    ) : stats.error ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <AnimatedCounter value={s.value} duration={2.2} />
                    )}
                  </dd>
                  <dt className="mt-1 text-xs text-muted sm:text-sm">{s.label}</dt>
                </div>
              ))}
            </motion.dl>
            {stats.error && (
              <p className="mt-3 text-xs text-muted">Live stats are taking a breather — {stats.error.message}</p>
            )}
          </motion.div>

          <HeroVisual />
        </div>
      </section>

      {/* Features */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="label">Everything in one place</motion.p>
          <motion.h2 variants={fadeUp} className="mt-3 max-w-2xl text-3xl font-bold sm:text-5xl">
            Built for the floor, <span className="text-gradient">not the spreadsheet.</span>
          </motion.h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <motion.button
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                onClick={() => navigate(f.to)}
                className="glass group p-6 text-left transition-shadow hover:shadow-glow"
              >
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${f.bg}`}>
                  <f.icon className={`h-6 w-6 ${f.color}`} />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Quote band */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="glass relative overflow-hidden p-8 sm:p-12"
        >
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-accent2/20 blur-3xl" />
          <p className="label relative">Quote of the day</p>
          <p className="relative mt-4 max-w-3xl font-display text-2xl font-semibold leading-tight sm:text-4xl">
            “{quote.text}”
          </p>
          <div className="relative mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted">— {quote.author}</p>
            <button onClick={startWorkout} className="btn-primary">
              Start Your Workout <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </section>

      <Footer navigate={navigate} />
    </div>
  )
}

function HeroPulseLine() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 -bottom-6 h-32 w-full opacity-40 dark:opacity-60"
      viewBox="0 0 1200 160"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-line" x1="0" x2="1">
          <stop offset="0" stopColor="#C6FF3D" stopOpacity="0" />
          <stop offset="0.3" stopColor="#C6FF3D" />
          <stop offset="0.7" stopColor="#22E4F2" />
          <stop offset="1" stopColor="#22E4F2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d="M0 80 H380 L410 30 L450 140 L490 10 L530 120 L560 80 H760 L785 50 L810 105 L835 80 H1200"
        fill="none"
        stroke="url(#hero-line)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop', repeatDelay: 0.6 }}
      />
    </svg>
  )
}

function HeroVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, ease, delay: 0.2 }}
      className="relative mx-auto mt-12 w-full max-w-md lg:mt-0" // room for the floating streak chip above the card on phones
    >
      <div className="absolute inset-6 rounded-[40px] bg-gradient-brand opacity-30 blur-3xl" />

      <div className="glass relative !rounded-[32px] p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Today</p>
            <p className="mt-1 font-display text-2xl font-bold">Push Power</p>
          </div>
          <span className="chip bg-accent/15 text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Live
          </span>
        </div>

        <div className="mt-6 flex items-center justify-center">
          <ProgressRing value={0.72} size={200} stroke={14} color="#C6FF3D" delay={0.6}>
            <div>
              <p className="font-display text-5xl font-bold tabular-nums">
                <AnimatedCounter value={72} suffix="%" duration={1.6} />
              </p>
              <p className="text-xs text-muted">Session complete</p>
            </div>
          </ProgressRing>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { k: 'Sets', v: '10/13' },
            { k: 'Volume', v: '4.2t' },
            { k: 'Time', v: '34:12' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-line/[0.04] py-3">
              <p className="font-display text-lg font-bold tabular-nums">{x.v}</p>
              <p className="text-[11px] text-muted">{x.k}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating chips */}
      <motion.div
        className="glass absolute -left-3 -top-12 flex items-center gap-3 !rounded-2xl px-4 py-3 sm:-left-12"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-ember/15">
          <Flame className="h-5 w-5 text-ember" />
        </div>
        <div>
          <p className="font-display font-bold leading-none">{heroMock.streak}-day streak</p>
          <p className="mt-1 text-[11px] text-muted">Personal best: {heroMock.bestStreak}</p>
        </div>
      </motion.div>

      <motion.div
        className="glass absolute -right-2 bottom-24 flex items-center gap-3 !rounded-2xl px-4 py-3 sm:-right-10"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent2/15">
          <HeartPulse className="h-5 w-5 text-accent2" />
        </div>
        <div>
          <p className="font-display font-bold leading-none tabular-nums">142 bpm</p>
          <p className="mt-1 text-[11px] text-muted">Zone 4 · Threshold</p>
        </div>
      </motion.div>

      <motion.div
        className="glass absolute -bottom-6 left-8 flex items-center gap-2 !rounded-2xl px-4 py-2.5"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <Trophy className="h-4 w-4 text-[#FFC53D]" />
        <p className="text-sm font-semibold">New PR · Deadlift 172.5kg</p>
      </motion.div>
    </motion.div>
  )
}
