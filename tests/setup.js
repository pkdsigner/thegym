// Runs before every backend test file.
// Tests never use the real database: by default each file gets its own throwaway in-memory Postgres.
// Set TEST_DATABASE_URL to run the same tests against a Neon database instead (test users are cleaned up).
process.env.JWT_SECRET = 'vitest-only-secret-0f3b9c2e7a1d4f6b8e5c'
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL
