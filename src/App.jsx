import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, LogOut } from 'lucide-react'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import Logo from './components/Logo'
import ThemeToggle from './components/ThemeToggle'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import { useToast } from './components/Toast'
import { page as pageVariants } from './components/motion'
import { PROTECTED_PAGES, useHashRoute } from './hooks/useHashRoute'
import { initialsOf, useAuth } from './hooks/useAuth'
import Landing from './pages/Landing'
import { Login, Signup } from './pages/Auth'
// Logged-in screens load on demand, so the landing page doesn't download the charts library
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Library = lazy(() => import('./pages/Library'))
const LiveWorkout = lazy(() => import('./pages/LiveWorkout'))
const Progress = lazy(() => import('./pages/Progress'))
const Classes = lazy(() => import('./pages/Classes'))
const Profile = lazy(() => import('./pages/Profile'))

function ScreenLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
    </div>
  )
}

function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden noise" aria-hidden="true">
      <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full blur-[120px]" style={{ background: 'var(--orb-a)' }} />
      <div className="absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full blur-[120px]" style={{ background: 'var(--orb-b)' }} />
      <div className="absolute -bottom-40 left-1/3 h-[380px] w-[380px] rounded-full blur-[120px]" style={{ background: 'var(--orb-a)', opacity: 0.6 }} />
    </div>
  )
}

export default function App() {
  const [page, navigate] = useHashRoute()
  const { user, loading, logout } = useAuth()
  const toast = useToast()
  const [bookings, setBookings] = useState(() => new Set(['c7']))
  const nextPage = useRef(null)
  const mainRef = useRef(null)
  const firstScreen = useRef(true)

  const needsLogin = PROTECTED_PAGES.includes(page) && !user

  // On every screen change, move keyboard focus to the new content (like a real page load would),
  // so Tab continues from the top of the new screen instead of from the old button's position.
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [page])

  // Send logged-out visitors to log in, then bring them back where they were going
  useEffect(() => {
    if (loading) return
    if (needsLogin) {
      nextPage.current = page
      navigate('login')
    } else if (user && (page === 'login' || page === 'signup')) {
      // Just logged in (or already logged in): go where they were heading, else the Dashboard.
      // This is the only place that redirects after login, so nothing can race it.
      navigate(nextPage.current || 'dashboard')
      nextPage.current = null
    }
  }, [loading, needsLogin, user, page, navigate])

  const handleLogout = useCallback(async () => {
    try {
      // Leave the protected page first, otherwise the login guard sees "no user" and wins the race
      navigate('home')
      await logout()
      toast({ type: 'info', title: 'Logged out', message: 'See you at your next session 👋' })
    } catch (err) {
      toast({ type: 'error', title: 'Couldn’t log out', message: err.message })
    }
  }, [logout, toast, navigate])

  if (page === 'home') {
    return (
      <>
        <Backdrop />
        <ErrorBoundary>
          <Landing navigate={navigate} onLogout={handleLogout} />
        </ErrorBoundary>
      </>
    )
  }

  if (page === 'login' || page === 'signup') {
    const Screen = page === 'login' ? Login : Signup
    return (
      <>
        <Backdrop />
        <ErrorBoundary>
          <Screen navigate={navigate} />
        </ErrorBoundary>
      </>
    )
  }

  if (loading || needsLogin) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Backdrop />
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const screens = {
    dashboard: <Dashboard navigate={navigate} bookings={bookings} />,
    library: <Library navigate={navigate} />,
    live: <LiveWorkout navigate={navigate} />,
    progress: <Progress />,
    classes: <Classes bookings={bookings} setBookings={setBookings} />,
    profile: <Profile />,
  }

  return (
    <div className="min-h-dvh lg:flex">
      <Backdrop />
      <Sidebar page={page} navigate={navigate} onLogout={handleLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/[0.06] bg-bg/75 px-4 backdrop-blur-xl lg:hidden">
          <Logo onClick={() => navigate('home')} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <button
                  onClick={() => navigate('profile')}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand font-display text-sm font-bold text-[#0A0D10]"
                  title={user.fullName}
                >
                  {initialsOf(user.fullName)}
                  <span className="sr-only"> — open profile for {user.fullName}</span>
                </button>
                <button onClick={handleLogout} className="grid h-10 w-10 place-items-center rounded-xl border border-line/10 bg-line/[0.04] text-muted hover:text-ink" aria-label="Log out" title="Log out">
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </>
            ) : (
              <button onClick={() => navigate('login')} className="btn-ghost !py-2 text-sm">
                Log in
              </button>
            )}
          </div>
        </header>

        <main
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 outline-none sm:px-6 lg:px-10 lg:pb-12 lg:pt-10"
        >
          <ErrorBoundary key={page}>
            <AnimatePresence mode="wait">
              <motion.div key={page} variants={pageVariants} initial="hidden" animate="show" exit="exit">
                <Suspense fallback={<ScreenLoader />}>{screens[page]}</Suspense>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        <div className="pb-28 lg:pb-0">
          <Footer navigate={navigate} />
        </div>
      </div>

      <BottomNav page={page} navigate={navigate} />
    </div>
  )
}
