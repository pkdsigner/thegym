import { describe, expect, it } from 'vitest'
import { HttpError, getCookie, parseDate, parseId, readBody } from '../../lib/http.js'

describe('readBody', () => {
  it('returns parsed objects and parses JSON strings', () => {
    expect(readBody({ body: { a: 1 } })).toEqual({ a: 1 })
    expect(readBody({ body: '{"a":2}' })).toEqual({ a: 2 })
    expect(readBody({})).toEqual({})
  })

  it('turns malformed JSON into a friendly 400 (string body)', () => {
    expect(() => readBody({ body: '{oops' })).toThrow(HttpError)
  })

  it('turns malformed JSON into a friendly 400 on Vercel, where req.body throws', () => {
    const vercelReq = {
      get body() {
        throw new Error('Invalid JSON')
      },
    }
    let err
    try {
      readBody(vercelReq)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(HttpError)
    expect(err.status).toBe(400)
  })
})

describe('parseDate / parseId / getCookie', () => {
  it('accepts real YYYY-MM-DD dates and falls back to today otherwise', () => {
    expect(parseDate('2026-03-11')).toBe('2026-03-11')
    for (const bad of ['2026-13-45', '11/03/2026', "2026-03-11'; DROP TABLE users;--", undefined, 42]) {
      expect(parseDate(bad)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(parseDate(bad)).not.toBe(bad)
    }
  })

  it('only accepts positive whole-number ids', () => {
    expect(parseId('7')).toBe(7)
    for (const bad of ['abc', -1, 0, 1.5, null, '1; DROP']) expect(() => parseId(bad)).toThrow(HttpError)
  })

  it('reads a cookie by name', () => {
    expect(getCookie({ headers: { cookie: 'a=1; pf_session=abc.def; b=2' } }, 'pf_session')).toBe('abc.def')
    expect(getCookie({ headers: {} }, 'pf_session')).toBeNull()
  })
})
