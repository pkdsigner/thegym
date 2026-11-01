import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarX, Check, Clock, Loader2, MapPin, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import { fadeUp } from '../components/motion'
import { useToast } from '../components/Toast'
import { useTheme } from '../hooks/useTheme'
import { classTypes, classes, weekDays } from '../data/mock'

const todayIdx = (new Date().getDay() + 6) % 7

// Open on today, or the nearest day that actually has classes.
function defaultDay() {
  const hasClasses = (i) => classes.some((c) => c.day === weekDays[i])
  for (let i = todayIdx; i < weekDays.length; i++) if (hasClasses(i)) return weekDays[i]
  for (let i = todayIdx - 1; i >= 0; i--) if (hasClasses(i)) return weekDays[i]
  return weekDays[todayIdx]
}

function weekDates() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - todayIdx)
  return weekDays.map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.getDate()
  })
}

export default function Classes({ bookings, setBookings }) {
  const toast = useToast()
  const [day, setDay] = useState(defaultDay)
  const [type, setType] = useState('All')
  const [pending, setPending] = useState(null)
  const [waitlist, setWaitlist] = useState(() => new Set())
  const dates = useMemo(weekDates, [])

  const list = classes.filter((c) => c.day === day && (type === 'All' || c.type === type))

  const book = (c) => {
    if (bookings.has(c.id)) {
      setBookings((b) => {
        const n = new Set(b)
        n.delete(c.id)
        return n
      })
      toast({ type: 'info', title: 'Booking cancelled', message: `Your spot in ${c.name} is free for someone else.` })
      return
    }
    if (c.spots === 0) {
      if (waitlist.has(c.id)) {
        toast({ type: 'info', title: 'Already on the waitlist', message: 'We’ll ping you the moment a spot opens.' })
        return
      }
      setWaitlist((w) => new Set(w).add(c.id))
      toast({
        type: 'error',
        title: 'This class is full',
        message: 'No stress — we added you to the waitlist and will notify you if a spot opens.',
      })
      return
    }
    setPending(c.id)
    setTimeout(() => {
      setPending(null)
      setBookings((b) => new Set(b).add(c.id))
      toast({ title: 'You’re in! 🎉', message: `${c.name} · ${c.day} ${c.time} with ${c.coach}` })
    }, 700)
  }

  return (
    <>
      <PageHeader eyebrow="Class booking" title="This week at PulseFit" subtitle="Yoga, HIIT, Spin and Boxing led by our best coaches. Spots go fast." >
        <div className="chip border border-line/10 bg-line/[0.04] !px-3.5 !py-2 text-sm text-ink">
          <Check className="h-4 w-4 text-accent" /> {bookings.size} booked
        </div>
      </PageHeader>

      {/* Day picker */}
      <motion.div variants={fadeUp} className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {weekDays.map((d, i) => {
          const active = d === day
          const count = classes.filter((c) => c.day === d).length
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`relative flex min-w-[64px] flex-1 flex-col items-center rounded-2xl px-3 py-3 transition ${
                active ? 'text-[#0A0D10]' : 'border border-line/10 bg-line/[0.03] text-ink hover:border-line/20'
              }`}
              aria-pressed={active}
            >
              {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-gradient-brand shadow-glow" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className={`relative text-[11px] font-semibold uppercase tracking-wider ${active ? '' : 'text-muted'}`}>{d}</span>
              <span className="relative font-display text-xl font-bold">{dates[i]}</span>
              <span className="relative mt-1 flex gap-0.5">
                {Array.from({ length: Math.min(count, 4) }).map((_, k) => (
                  <span key={k} className={`h-1 w-1 rounded-full ${active ? 'bg-[#0A0D10]/60' : 'bg-accent'}`} />
                ))}
              </span>
              {i === todayIdx && !active && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ember" />}
            </button>
          )
        })}
      </motion.div>

      {/* Type filter */}
      <motion.div variants={fadeUp} className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {['All', ...Object.keys(classTypes)].map((t) => {
          const active = t === type
          const color = classTypes[t]?.color
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`chip shrink-0 border !px-4 !py-2 text-sm transition ${
                active ? 'border-transparent bg-ink text-bg' : 'border-line/10 text-muted hover:text-ink'
              }`}
            >
              {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
              {t}
            </button>
          )
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {list.length === 0 ? (
          <motion.div key={`empty-${day}-${type}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={CalendarX}
              title={day === 'Sun' ? 'Sunday is recovery day' : 'No classes match'}
              message={
                day === 'Sun'
                  ? 'The studios are resting today — and maybe you should too. Check out Saturday’s schedule.'
                  : `There’s no ${type} class on ${day}. Try another day or show all class types.`
              }
              action={day === 'Sun' ? 'See Saturday' : 'Show all types'}
              onAction={() => (day === 'Sun' ? setDay('Sat') : setType('All'))}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`${day}-${type}`}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0 }}
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            className="grid gap-3"
          >
            {list.map((c) => (
              <ClassCard key={c.id} c={c} booked={bookings.has(c.id)} pending={pending === c.id} waitlisted={waitlist.has(c.id)} onBook={() => book(c)} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function ClassCard({ c, booked, pending, waitlisted, onBook }) {
  const t = classTypes[c.type]
  const { theme } = useTheme()
  const typeText = theme === 'dark' ? t.color : t.ink // deeper shade keeps text readable in light mode
  const spotsLeft = Math.max(0, c.spots - (booked ? 1 : 0))
  const full = c.spots === 0
  const low = !full && spotsLeft <= 3
  const fill = ((c.capacity - spotsLeft) / c.capacity) * 100

  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -3 }}
      className={`glass flex flex-col gap-4 !rounded-2xl p-4 transition-shadow sm:flex-row sm:items-center sm:p-5 ${booked ? 'ring-1 ring-accent/40 shadow-glow' : ''}`}
    >
      <div className="flex items-center gap-4 sm:w-auto">
        <div className="w-16 shrink-0 text-center">
          <p className="font-display text-2xl font-bold tabular-nums">{c.time}</p>
          <p className="text-xs text-muted">{c.duration} min</p>
        </div>
        <div className="h-12 w-px bg-line/10" />
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: `${t.color}22`, boxShadow: `inset 0 0 0 1px ${t.color}40` }}>
          {t.emoji}
        </div>
        <div className="min-w-0 sm:hidden">
          <p className="truncate font-display font-semibold">{c.name}</p>
          <p className="text-xs font-semibold" style={{ color: typeText }}>{c.type}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="hidden items-center gap-2 sm:flex">
          <p className="truncate font-display text-lg font-semibold">{c.name}</p>
          <span className="chip !py-0.5" style={{ backgroundColor: `${t.color}1f`, color: typeText }}>{c.type}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted sm:mt-1">
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{c.coach}</span>
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{c.room}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{c.duration} min</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/[0.07] sm:max-w-[220px]">
            <motion.div
              className={`h-full rounded-full ${full ? 'bg-ember' : low ? 'bg-[#FFC53D]' : 'bg-gradient-brand'}`}
              initial={{ width: 0 }}
              animate={{ width: `${fill}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <span className={`text-xs font-semibold ${full ? 'text-ember' : low ? 'text-[#8a6200] dark:text-[#FFC53D]' : 'text-muted'}`}>
            {full ? 'Full' : low ? `Only ${spotsLeft} left!` : `${spotsLeft} spots left`}
          </span>
        </div>
      </div>

      <button
        onClick={onBook}
        disabled={pending}
        className={`w-full sm:w-36 ${booked ? 'btn-ghost !border-accent/40 !text-accent' : full ? 'btn-ghost' : 'btn-primary'}`}
      >
        {pending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</>
        ) : booked ? (
          <><Check className="h-4 w-4" strokeWidth={3} /> Booked</>
        ) : full ? (
          waitlisted ? 'On waitlist' : 'Join waitlist'
        ) : (
          'Book'
        )}
      </button>
    </motion.article>
  )
}
