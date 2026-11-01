import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
