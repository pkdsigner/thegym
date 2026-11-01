import { useState } from 'react'
import { motion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LineChart as LineChartIcon, Medal, TrendingUp, Trophy } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import GlassCard from '../components/GlassCard'
import AnimatedCounter from '../components/AnimatedCounter'
import EmptyState from '../components/EmptyState'
import { fadeUp } from '../components/motion'
import { useChartColors, useTheme } from '../hooks/useTheme'
import { personalRecords, strengthHistory } from '../data/mock'

// color: medal glow in both themes · ink: label text on the light theme (≥4.5:1 contrast)
const tiers = {
  gold: { color: '#FFC53D', ink: '#8a6200', label: 'Gold' },
  silver: { color: '#B8C4CF', ink: '#4a525a', label: 'Silver' },
  bronze: { color: '#E0915A', ink: '#8a4413', label: 'Bronze' },
}

export default function Progress() {
  const c = useChartColors()
  const { theme } = useTheme()
  const lifts = [
    { key: 'deadlift', label: 'Deadlift', color: c.lime },
    { key: 'squat', label: 'Squat', color: c.cyan },
    { key: 'bench', label: 'Bench', color: c.ember },
  ]
  const [visible, setVisible] = useState({ deadlift: true, squat: true, bench: true })
  const first = strengthHistory[0]
  const last = strengthHistory[strengthHistory.length - 1]
  const anyVisible = Object.values(visible).some(Boolean)

  return (
    <>
      <PageHeader eyebrow="Progress" title="Your strength story" subtitle="Seven months of steady gains. Every line here went up because you showed up." />

      <div className="grid gap-4 sm:grid-cols-3">
        {lifts.map((l, i) => {
          const gain = last[l.key] - first[l.key]
          const pct = Math.round((gain / first[l.key]) * 100)
          return (
            <GlassCard key={l.key} hover className="p-5">
              <div className="flex items-center justify-between">
                <span className="label">{l.label}</span>
                <span className="chip bg-accent/10 text-accent">
                  <TrendingUp className="h-3 w-3" /> {pct}%
                </span>
              </div>
              <p className="mt-3 font-display text-4xl font-bold">
                <AnimatedCounter value={last[l.key]} decimals={last[l.key] % 1 ? 1 : 0} />
                <span className="ml-1 text-base font-medium text-muted">kg</span>
              </p>
              <p className="mt-1 text-sm text-muted">+{gain} kg since {first.month}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line/[0.07]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: l.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, pct)}%` }}
                  transition={{ duration: 1.2, delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </GlassCard>
          )
        })}
      </div>

      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="label">Strength gains</span>
            <p className="mt-1 font-display text-xl font-semibold">Estimated 1-rep max (kg)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {lifts.map((l) => (
              <button
                key={l.key}
                onClick={() => setVisible((v) => ({ ...v, [l.key]: !v[l.key] }))}
                className={`chip border transition ${visible[l.key] ? 'border-line/15 bg-line/[0.06] text-ink' : 'border-line/10 text-muted opacity-60'}`}
                aria-pressed={visible[l.key]}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-72 sm:h-80">
          {anyVisible ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={strengthHistory} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: c.tick, fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: c.tick, fontSize: 12 }} domain={[40, 200]} ticks={[40, 80, 120, 160, 200]} />
                <Tooltip content={<LiftTooltip colors={c} lifts={lifts} />} cursor={{ stroke: c.grid, strokeWidth: 2 }} />
                {lifts.map(
                  (l) =>
                    visible[l.key] && (
                      <Line
                        key={l.key}
                        type="monotone"
                        dataKey={l.key}
                        stroke={l.color}
                        strokeWidth={3}
                        dot={{ r: 3.5, fill: l.color, strokeWidth: 0 }}
                        activeDot={{ r: 6, stroke: l.color, strokeWidth: 3, fill: c.tooltipBg }}
                        animationDuration={1400}
                        style={{ filter: `drop-shadow(0 4px 10px ${l.color}55)` }}
                      />
                    ),
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              icon={LineChartIcon}
              title="Nothing to chart"
              message="Toggle at least one lift above to see your progress curve."
              action="Show all lifts"
              onAction={() => setVisible({ deadlift: true, squat: true, bench: true })}
            />
          )}
        </div>
      </GlassCard>

      <motion.div variants={fadeUp} className="mb-4 mt-10 flex items-end justify-between">
        <div>
          <p className="label">Hall of fame</p>
          <h2 className="mt-1 text-2xl font-bold">Personal records</h2>
        </div>
        <span className="chip bg-[#FFC53D]/15 text-[#8a6200] dark:text-[#FFC53D]">
          <Medal className="h-3.5 w-3.5" /> {personalRecords.length} PRs
        </span>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {personalRecords.map((pr) => {
          const t = tiers[pr.tier]
          return (
            <GlassCard key={pr.lift} hover className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <motion.div
                  whileHover={{ rotate: [0, -12, 12, 0] }}
                  transition={{ duration: 0.5 }}
                  className="relative grid h-12 w-12 place-items-center rounded-2xl"
                  style={{ background: `linear-gradient(135deg, ${t.color}40, ${t.color}10)`, boxShadow: `0 0 24px -6px ${t.color}90` }}
                >
                  <Trophy className="h-6 w-6" style={{ color: t.color }} />
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme === 'dark' ? t.color : t.ink }}>
                  {t.label}
                </span>
              </div>
              <p className="mt-4 text-sm text-muted">{pr.lift}</p>
              <p className="font-display text-2xl font-bold tabular-nums sm:text-3xl">
                {pr.value}
                {pr.unit && <span className="ml-1 text-sm font-medium text-muted">{pr.unit}</span>}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-1 text-xs">
                <span className="text-muted">{pr.date}</span>
                <span className="font-semibold text-accent">{pr.delta}</span>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </>
  )
}

function LiftTooltip({ active, payload, label, colors, lifts }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm shadow-xl backdrop-blur"
      style={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, color: colors.ink }}
    >
      <p className="mb-1 font-display font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted">{lifts.find((l) => l.key === p.dataKey)?.label}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{p.value} kg</span>
        </p>
      ))}
    </div>
  )
}
