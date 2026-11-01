import { useCallback, useEffect, useState } from 'react'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

const SERVER_DOWN = "Can't reach the PulseFit server. Make sure “npm run dev” is running, then try again."

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(SERVER_DOWN, 0, 'NETWORK')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty or non-JSON body */
  }

  if (!res.ok) {
    // The Vite proxy answers 5xx with no JSON when the API server isn't running
    if (!data && res.status >= 500) throw new ApiError(SERVER_DOWN, res.status, 'NETWORK')
    // Session expired or was revoked while the app was open → let the app log out and go to Login
    if (res.status === 401 && !path.startsWith('/api/auth/')) window.dispatchEvent(new Event('pulsefit:unauthorized'))
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status, data?.code)
  }
  return data
}

// Local calendar date (YYYY-MM-DD) so "today" means the user's today, not the server's.
export function todayISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await api(path)
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
  }, [path])

  useEffect(() => {
    load()
  }, [load])

  const setData = useCallback(
    (update) => setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update })),
    [],
  )

  return { ...state, reload: load, setData }
}
