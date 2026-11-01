import { useId } from 'react'
import { motion } from 'framer-motion'

export function PulseIcon({ className = 'h-5 w-5', animate = true }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C6FF3D" />
          <stop offset="1" stopColor="#22E4F2" />
        </linearGradient>
      </defs>
      <motion.path
        d="M4 34h14l6-14 9 28 7-18 5 4h15"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </svg>
  )
}

export default function Logo({ onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label="PulseFit home"
    >
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[#0A0D10] ring-1 ring-white/10 shadow-glow transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105">
        <PulseIcon className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="font-display text-[22px] font-bold leading-none tracking-[-0.04em] text-gradient">
          PulseFit
        </span>
      )}
    </button>
  )
}
