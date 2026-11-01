// Tiny helpers shared by every /api route. Works with both Vercel functions and the local Express server.
import { isDbConnectionError, MissingConfigError } from './db.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function handler(methods, fn) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '))
      return res.status(405).json({ error: `Method ${req.method} not allowed` })
    }
    res.setHeader('Cache-Control', 'no-store')
    try {
      await fn(req, res)
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
      if (err instanceof MissingConfigError) {
        console.error(`[api] ${err.message}`)
        return res.status(503).json({ error: `The server isn't set up yet: ${err.varName} is missing from .env.`, code: 'CONFIG' })
      }
      if (isDbConnectionError(err)) {
        console.error('[api] Database unreachable:', err.message)
        return res.status(503).json({
          error: "We can't reach the database right now. Check your internet connection and DATABASE_URL, then try again.",
          code: 'DB_UNREACHABLE',
        })
      }
      console.error('[api] Unexpected error:', err)
      return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' })
    }
  }
}

export function readBody(req) {
  let body
  try {
    body = req.body // on Vercel this getter throws if the JSON is malformed
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
  if (body && typeof body === 'object') return body
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      throw new HttpError(400, 'Request body must be valid JSON.')
    }
  }
  return {}
}

export function getCookie(req, name) {
  const header = req.headers?.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

// Client sends its local date so "today" matches the user's timezone.
export function parseDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return value
  return new Date().toISOString().slice(0, 10)
}

export function parseId(value, label = 'id') {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `A valid ${label} is required.`)
  return id
}
