import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['js/**/*.ts'],
      exclude: [
        'js/map/map-section.ts',
        'js/app.ts',
        'js/viewers/**',
        'js/qr/**',
        'js/map/tools/**',
      ],
      thresholds: {
        statements: 65,
        branches: 65,
        functions: 70,
        lines: 65,
      },
    },
  },
});
