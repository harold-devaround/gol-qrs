import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['js/**/*.ts'],
      exclude: ['js/map/map-section.ts', 'js/app.ts', 'js/viewers/**', 'js/qr/**'],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});
