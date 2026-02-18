import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/client'],
    setupFiles: ['./src/server/__tests__/setup.ts'],
    testTimeout: 10000,
    pool: 'forks',
  },
});
