import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, Calendar, Crown, Dumbbell, Flame, Lock, Moon, Sparkles, Sunrise, Target, Timer, Trophy } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import GlassCard from '../components/GlassCard'
import AnimatedCounter from '../components/AnimatedCounter'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../components/Toast'
import { initialsOf, useAuth } from '../hooks/useAuth'
import { achievements, profileStats, user as gamification } from '../data/mock'

const icons = { Sparkles, Flame, Dumbbell, Sunrise, Trophy, Calendar, Timer, Crown }

export default function Profile() {
  const { user: account } = useAuth()
  // Account details are real; level, XP and badges are still demo data
  const user = {
    ...gamification,
    name: account.fullName,
    initials: initialsOf(account.fullName),
    handle: account.email,
    memberSince: new Date(account.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    weeklyGoal: account.weeklyGoalWorkouts,
    weeklyMinutes: account.weeklyGoalMinutes,
  }
  const { theme, toggle } = useTheme()
  const toast = useToast()
  const [notify, setNotify] = useState(true)
  const unlocked = achievements.filter((a) => a.unlocked).length
  const xpPct = (user.xp / user.xpNext) * 100

  return (
    <>
      <PageHeader eyebrow="Profile" title="You, levelling up" />

      <GlassCard className="p-0">
        <div className="relative h-28 overflow-hidden sm:h-36">
          <div className="absolute inset-0 bg-gradient-brand opacity-90" />
          <div className="grid-bg absolute inset-0 opacity-60 mix-blend-overlay" />
          <svg className="absolute bottom-3 left-0 h-16 w-full opacity-40" viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 30 H200 L220 8 L245 55 L270 2 L295 45 L310 30 H600" fill="none" stroke="#0A0D10" strokeWidth="2.5" />
          </svg>
        </div>
        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                className="relative rounded-[28px] p-1"
                style={{ background: 'conic-gradient(from 180deg, #C6FF3D, #22E4F2, #9B7BFF, #C6FF3D)' }}
              >
                <div className="grid h-24 w-24 place-items-center rounded-[24px] bg-surface font-display text-3xl font-bold sm:h-28 sm:w-28">
                  <span className="text-gradient">{user.initials}</span>
                </div>
                <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-xl bg-[#0A0D10] font-display text-xs font-bold text-lime ring-2 ring-surface">
                  {user.level}
                </span>
              </motion.div>
              <div className="pb-1">
                <h2 className="text-2xl font-bold sm:text-3xl">{user.name}</h2>
                <p className="text-sm text-muted">{user.handle} · Member since {user.memberSince}</p>
              </div>
            </div>
            <span className="chip self-start border border-[#FFC53D]/40 bg-[#FFC53D]/15 !px-4 !py-2 text-sm text-[#8a6200] sm:self-auto dark:text-[#FFC53D]">
              <Crown className="h-4 w-4" /> {user.membership}
            </span>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">Level {user.level}</span>
              <span className="text-muted tabular-nums">
                {user.xp.toLocaleString()} / {user.xpNext.toLocaleString()} XP
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line/[0.07]">
              <motion.div
                className="h-full rounded-full bg-gradient-brand shadow-glow"
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">{(user.xpNext - user.xp).toLocaleString()} XP to Level {user.level + 1}</p>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-2">
            {profileStats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-line/[0.04] py-3 text-center">
                <p className="font-display text-xl font-bold sm:text-2xl">
                  <AnimatedCounter value={s.value} />
                </p>
                <p className="text-[11px] text-muted sm:text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="mb-4 mt-10 flex items-end justify-between">
        <div>
          <p className="label">Achievements</p>
          <h2 className="mt-1 text-2xl font-bold">Badges</h2>
        </div>
        <span className="text-sm text-muted">
          <span className="font-semibold text-ink">{unlocked}</span> / {achievements.length} unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a) => {
          const Icon = icons[a.icon] ?? Trophy
          return (
            <GlassCard key={a.id} hover={a.unlocked} className={`flex flex-col items-center p-5 text-center ${a.unlocked ? '' : 'opacity-70'}`}>
              <div className="relative">
                {a.unlocked && <div className="absolute inset-0 rounded-full bg-accent/40 blur-xl" />}
                <div
                  className={`relative grid h-16 w-16 place-items-center rounded-full ${
                    a.unlocked ? 'bg-gradient-brand text-[#0A0D10] shadow-glow' : 'bg-line/[0.06] text-muted ring-1 ring-line/10'
                  }`}
                >
                  <Icon className="h-7 w-7" />
                  {!a.unlocked && (
                    <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-surface ring-1 ring-line/10">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-4 font-display font-semibold">{a.name}</p>
              <p className="mt-0.5 text-xs text-muted">{a.desc}</p>
              {!a.unlocked && (
                <div className="mt-3 w-full">
                  <div className="h-1 overflow-hidden rounded-full bg-line/[0.07]">
                    <motion.div className="h-full rounded-full bg-accent2" initial={{ width: 0 }} animate={{ width: `${a.progress * 100}%` }} transition={{ duration: 1, delay: 0.3 }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted">{Math.round(a.progress * 100)}%</p>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>

      <GlassCard className="mt-10 divide-y divide-line/[0.06] p-2">
        <SettingRow icon={Moon} title="Dark mode" desc="Easy on the eyes between sets">
          <Switch on={theme === 'dark'} onChange={toggle} label="Dark mode" />
        </SettingRow>
        <SettingRow icon={Bell} title="Workout reminders" desc="A nudge when it’s time to train">
          <Switch
            on={notify}
            onChange={() => {
              setNotify(!notify)
              toast({ type: 'info', title: notify ? 'Reminders paused' : 'Reminders on', message: notify ? 'We’ll keep quiet for now.' : 'We’ll nudge you at 6:00 pm.' })
            }}
            label="Workout reminders"
          />
        </SettingRow>
        <SettingRow icon={Target} title="Weekly goals" desc="Workouts and active minutes per week">
          <span className="font-display text-lg font-bold">
            {user.weeklyGoal} <span className="text-sm font-medium text-muted">·</span> {user.weeklyMinutes}
            <span className="ml-1 text-sm font-medium text-muted">min</span>
          </span>
        </SettingRow>
      </GlassCard>
    </>
  )
}

function SettingRow({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-line/[0.05]">
        <Icon className="h-[18px] w-[18px] text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted">{desc}</p>
      </div>
      {children}
    </div>
  )
}

function Switch({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-gradient-brand shadow-glow' : 'bg-line/15'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-1 h-5 w-5 rounded-full shadow ${on ? 'right-1 bg-[#0A0D10]' : 'left-1 bg-white'}`}
      />
    </button>
  )
}
