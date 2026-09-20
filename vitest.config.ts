import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // The replica set takes a moment to come up on a cold run.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Mongoose models are registered on a single connection, so the suites
    // share one in-memory server rather than racing for it.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Replaced by the in-memory replica set in setup.ts.
      MONGODB_URL: 'mongodb://127.0.0.1:27017/placeholder',
      JWT_ACCESS_SECRET: 'test-access-secret-that-is-long-enough-to-pass',
      JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-long-enough-to-pass',
      HOST: 'http://localhost:5000',
      SITE_NAME: 'Aide-mémoire',
      FRONT_END_LOCATION: 'http://localhost:3000',
      EMAIL_ADDRESS: 'owner@example.com',
      EMAIL_NAME: 'Aide-mémoire',
    },
  },
})
