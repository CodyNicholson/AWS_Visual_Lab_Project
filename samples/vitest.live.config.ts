import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['concepts/**/*.live.test.ts'],
    testTimeout: 120_000,
  },
});
