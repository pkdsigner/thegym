import { motion } from 'framer-motion'
import { navItems } from './nav'

export default function BottomNav({ page, navigate }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-safe lg:hidden"
      aria-label="Main"
    >
      <div className="glass mb-3 flex items-stretch justify-between !rounded-[26px] p-1.5">
        {navItems.map(({ id, short, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[10px] font-semibold transition-colors ${
                active ? 'text-ink' : 'text-muted'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute inset-0 rounded-2xl ring-1 ring-accent/25"
                  style={{ backgroundColor: 'rgb(var(--accent) / 0.12)' }}
                  transition={{ type: 'spring', stiffness: 450, damping: 34 }}
                />
              )}
              <Icon className={`relative h-5 w-5 ${active ? 'text-accent' : ''}`} />
              <span className="relative truncate">{short}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
