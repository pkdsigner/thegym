import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CircleCheck, Info, X } from 'lucide-react'

const ToastContext = createContext(() => {})

const styles = {
  success: { icon: CircleCheck, color: 'text-accent', ring: 'ring-accent/30' },
  error: { icon: AlertTriangle, color: 'text-ember', ring: 'ring-ember/30' },
  info: { icon: Info, color: 'text-accent2', ring: 'ring-accent2/30' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (toast) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((ts) => [...ts.slice(-2), { id, type: 'success', ...toast }])
      setTimeout(() => dismiss(id), toast.duration ?? 3800)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-96"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const s = styles[t.type] ?? styles.info
            const Icon = s.icon
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`glass pointer-events-auto flex items-start gap-3 !rounded-2xl p-4 ring-1 ${s.ring}`}
                role="status"
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{t.title}</p>
                  {t.message && <p className="mt-0.5 text-sm text-muted">{t.message}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="rounded-lg p-1 text-muted hover:bg-line/10 hover:text-ink" aria-label="Dismiss">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
