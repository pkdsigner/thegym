import { cloneElement, useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Minus, Plus, Target, Timer, User } from 'lucide-react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { ease, fadeUp, stagger } from '../components/motion'

function AuthLayout({ navigate, title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo onClick={() => navigate('home')} />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease }}
          className="relative w-full max-w-md"
        >
          <div className="absolute -inset-6 rounded-[48px] bg-gradient-brand opacity-20 blur-3xl" />
          <div className="glass relative !rounded-[32px] p-6 sm:p-8">
            <motion.div variants={stagger} initial="hidden" animate="show">
              <motion.h1 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
                {title}
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-2 text-muted">
                {subtitle}
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8">
                {children}
              </motion.div>
            </motion.div>
          </div>
          <p className="relative mt-6 text-center text-sm text-muted">{footer}</p>
        </motion.div>
      </main>
    </div>
  )
}

// The <label> only wraps its text (via htmlFor), so extra buttons like "show password"
// sit next to the input rather than inside the label.
function Field({ icon: Icon, label, children }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        {cloneElement(children, { id })}
      </div>
    </div>
  )
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder = 'Your password' }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required
        minLength={8}
        placeholder={placeholder}
        className="input pl-11 pr-11"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </>
  )
}

function FormError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-start gap-2 overflow-hidden rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function Stepper({ icon: Icon, label, value, onChange, min, max, step, unit }) {
  const clamp = (n) => Math.min(max, Math.max(min, n))
  return (
    <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="h-3.5 w-3.5 text-accent" /> {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button type="button" onClick={() => onChange(clamp(value - step))} className="grid h-8 w-8 place-items-center rounded-xl border border-line/10 hover:border-accent/40" aria-label={`Decrease ${label}`}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <p className="font-display text-xl font-bold tabular-nums">
          {value}
          <span className="ml-1 text-xs font-medium text-muted">{unit}</span>
        </p>
        <button type="button" onClick={() => onChange(clamp(value + step))} className="grid h-8 w-8 place-items-center rounded-xl border border-line/10 hover:border-accent/40" aria-label={`Increase ${label}`}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// After a successful login/sign-up, App redirects (to the page you were heading to, or the Dashboard).
export function Login({ navigate }) {
  const { login } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(email, password)
      toast({ title: `Welcome back, ${user.fullName.split(' ')[0]}!`, message: 'Let’s get after it.' })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      navigate={navigate}
      title={<>Welcome <span className="text-gradient">back.</span></>}
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          New to PulseFit?{' '}
          <button onClick={() => navigate('signup')} className="font-semibold text-accent hover:underline">
            Create an account
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field icon={Mail} label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" className="input pl-11" />
        </Field>
        <Field icon={Lock} label="Password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <FormError message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full !py-3.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? 'Logging in…' : 'Log in'}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </AuthLayout>
  )
}

export function Signup({ navigate }) {
  const { signup } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', weeklyGoalWorkouts: 4, weeklyGoalMinutes: 150 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) return setError('Please tell us your name.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('Password needs at least one letter and one number.')
    }
    setBusy(true)
    try {
      const user = await signup(form)
      toast({ title: `Welcome to PulseFit, ${user.fullName.split(' ')[0]}! 🎉`, message: 'Your account is ready. Let’s build today’s workout.' })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      navigate={navigate}
      title={<>Start your <span className="text-gradient">streak.</span></>}
      subtitle="Create your free account and set your weekly goals."
      footer={
        <>
          Already have an account?{' '}
          <button onClick={() => navigate('login')} className="font-semibold text-accent hover:underline">
            Log in
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field icon={User} label="Name">
          <input value={form.fullName} onChange={set('fullName')} autoComplete="name" required placeholder="Alex Rivera" className="input pl-11" />
        </Field>
        <Field icon={Mail} label="Email">
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required placeholder="you@example.com" className="input pl-11" />
        </Field>
        <Field icon={Lock} label="Password">
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="8+ characters, letters & numbers" />
        </Field>
        <div>
          <span className="label mb-2 block">Weekly goals</span>
          <div className="grid grid-cols-2 gap-3">
            <Stepper icon={Target} label="Workouts" unit="/ wk" value={form.weeklyGoalWorkouts} onChange={set('weeklyGoalWorkouts')} min={1} max={14} step={1} />
            <Stepper icon={Timer} label="Active minutes" unit="min" value={form.weeklyGoalMinutes} onChange={set('weeklyGoalMinutes')} min={15} max={1500} step={15} />
          </div>
        </div>
        <FormError message={error} />
        <button type="submit" disabled={busy} className="btn-primary w-full !py-3.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? 'Creating account…' : 'Create account'}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </AuthLayout>
  )
}
