import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Reuse the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/setup/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    env: loadEnv("test", process.cwd(), ""),
    // Playwright specs live in tests/e2e and run with their own runner.
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
