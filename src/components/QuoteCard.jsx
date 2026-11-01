import { Quote } from 'lucide-react'
import GlassCard from './GlassCard'
import { quotes } from '../data/mock'

export function quoteOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / 86_400_000)
  return quotes[dayOfYear % quotes.length]
}

export default function QuoteCard({ className = '' }) {
  const q = quoteOfTheDay()
  return (
    <GlassCard className={`p-6 ${className}`}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-accent2/20 blur-3xl" />
      <div className="flex items-center gap-2">
        <Quote className="h-4 w-4 text-accent" />
        <span className="label">Quote of the day</span>
      </div>
      <p className="mt-3 font-display text-lg font-medium leading-snug sm:text-xl">“{q.text}”</p>
      <p className="mt-3 text-sm text-muted">— {q.author}</p>
    </GlassCard>
  )
}
