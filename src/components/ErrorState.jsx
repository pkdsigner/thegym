import { motion } from 'framer-motion'
import { RotateCcw, ServerCrash } from 'lucide-react'

export default function ErrorState({ error, onRetry, className = '' }) {
  const offline = error?.code === 'DB_UNREACHABLE' || error?.code === 'NETWORK' || error?.code === 'CONFIG'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass flex flex-col items-center px-6 py-12 text-center ${className}`}
      role="alert"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-ember/25 blur-xl" />
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-ember/10 ring-1 ring-ember/30">
          <ServerCrash className="h-7 w-7 text-ember" />
        </div>
      </div>
      <h3 className="text-lg font-semibold">{offline ? 'We can’t reach the gym floor' : 'That didn’t go to plan'}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{error?.message || 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-6">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      )}
    </motion.div>
  )
}
