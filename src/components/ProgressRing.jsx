import { motion } from 'framer-motion'
import { ringProgress } from '../lib/rings'

export default function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = '#C6FF3D',
  delay = 0,
  transition,
  glow = true,
  children,
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = ringProgress(value, 1) // clamps to 0–1 and turns NaN into 0

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-line/[0.08]" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={transition ?? { duration: 1.5, ease: [0.22, 1, 0.36, 1], delay }}
          style={glow ? { filter: `drop-shadow(0 0 8px ${color}80)` } : undefined}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
