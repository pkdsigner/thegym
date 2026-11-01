// Server-only database access. Never import this from /src.
import { neon } from '@neondatabase/serverless'

export class MissingConfigError extends Error {
  constructor(name) {
    super(`${name} is not set. Add it to your .env file (see .env.example).`)
    this.varName = name
  }
}

let sql

export function getSql() {
  if (!process.env.DATABASE_URL) {
    // Local dev only: server/dev.js provides an embedded Postgres until a Neon URL is added
    if (globalThis.__pulsefitLocalSql) return globalThis.__pulsefitLocalSql
    throw new MissingConfigError('DATABASE_URL')
  }
  sql ??= neon(process.env.DATABASE_URL)
  return sql
}

const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', '28P01', '3D000', '08001', '08006'])

export function isDbConnectionError(err) {
  if (CONNECTION_CODES.has(err?.code) || CONNECTION_CODES.has(err?.cause?.code)) return true
  const msg = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`
  return /fetch failed|error connecting to database|getaddrinfo|password authentication failed|database .* does not exist|Invalid URL|invalid connection string/i.test(msg)
}
