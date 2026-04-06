import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests-output/**/*.test.ts'],
    testTimeout: 30000,
  },
});
