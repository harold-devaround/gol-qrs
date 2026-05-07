import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    // jsdom for everyone — legacy tests already used jsdom for some files;
    // forcing it globally is harmless for pure-Node geometry tests and
    // required for React/Konva tests under src/.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["js/**/*.ts", "src/**/*.{ts,tsx}"],
      exclude: [
        "js/map/map-section.ts",
        "js/app.ts",
        "js/viewers/**",
        "js/qr/**",
        "js/map/tools/**",
        "src/main.tsx",
        "src/router.tsx",
        "src/**/*.test.{ts,tsx}",
      ],
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});
