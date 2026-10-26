import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['concepts/**/*.test.ts'],
    exclude: ['**/*.live.test.ts', '**/node_modules/**'],
  },
});
