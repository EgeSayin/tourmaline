import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Reuse the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Playwright specs live in tests/e2e and run with their own runner.
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
