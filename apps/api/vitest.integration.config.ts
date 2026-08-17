import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.spec.ts'],
    setupFiles: ['./test/setup-environment.ts'],
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
