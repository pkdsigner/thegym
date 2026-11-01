import { useCallback, useEffect, useState } from 'react'

export const PAGES = ['home', 'login', 'signup', 'dashboard', 'library', 'live', 'progress', 'classes', 'profile']
export const PROTECTED_PAGES = ['dashboard', 'library', 'live', 'profile']

function readHash() {
  const h = window.location.hash.replace(/^#\/?/, '')
  return PAGES.includes(h) ? h : 'home'
}

// Tiny hash router: keeps the current screen on refresh and supports back/forward.
export function useHashRoute() {
  const [page, setPage] = useState(readHash)

  useEffect(() => {
    const onChange = () => {
      setPage(readHash())
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((next) => {
    window.location.hash = `/${next}`
  }, [])

  return [page, navigate]
}
