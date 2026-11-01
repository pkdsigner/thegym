import { motion } from 'framer-motion'

export default function EmptyState({ icon: Icon, title, message, action, onAction }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line/15 px-6 py-14 text-center"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl" />
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-line/[0.05] ring-1 ring-line/10">
          <Icon className="h-7 w-7 text-accent" />
        </div>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>
      {action && (
        <button onClick={onAction} className="btn-ghost mt-6">
          {action}
        </button>
      )}
    </motion.div>
  )
}
