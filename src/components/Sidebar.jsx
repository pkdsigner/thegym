import { motion } from 'framer-motion'
import { Flame, LogIn, LogOut } from 'lucide-react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import { navItems } from './nav'
import { initialsOf, useAuth } from '../hooks/useAuth'

export default function Sidebar({ page, navigate, onLogout }) {
  const { user } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/[0.06] px-4 py-6 lg:flex">
      <div className="px-2">
        <Logo onClick={() => navigate('home')} />
      </div>

      <nav className="mt-10 flex flex-col gap-1" aria-label="Main">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                active ? 'text-ink' : 'text-muted hover:bg-line/[0.04] hover:text-ink'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-2xl bg-accent/10 ring-1 ring-accent/25"
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className={`relative h-[18px] w-[18px] ${active ? 'text-accent' : ''}`} />
              <span className="relative">{label}</span>
              {id === 'live' && (
                <span className="relative ml-auto h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]" />
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3">
        {user ? (
          <>
            <div className="glass !rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-ember/15">
                  <Flame className="h-5 w-5 text-ember" />
                </div>
                <div>
                  <p className="font-display text-lg font-bold leading-none">
                    {user.streak} {user.streak === 1 ? 'day' : 'days'}
                  </p>
                  <p className="mt-1 text-xs text-muted">Current streak</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2">
              <button
                onClick={() => navigate('profile')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-brand font-display text-sm font-bold text-[#0A0D10]"
              >
                {initialsOf(user.fullName)}
                <span className="sr-only"> — open profile</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.fullName}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
              </div>
              <ThemeToggle />
              <button
                onClick={onLogout}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line/10 bg-line/[0.04] text-muted transition hover:border-line/20 hover:text-ink"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 px-2">
            <button onClick={() => navigate('login')} className="btn-ghost flex-1 !py-2.5 text-sm">
              <LogIn className="h-4 w-4" /> Log in
            </button>
            <ThemeToggle />
          </div>
        )}
      </div>
    </aside>
  )
}
