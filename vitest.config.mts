import { fileURLToPath } from "node:url";
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
    // Playwright specs live in tests/e2e and run with their own runner.
    exclude: ["tests/e2e/**", "node_modules/**"],
    tags: [
      {
        name: "unit",
        description: "Runs in isolation, without external services.",
      },
      {
        name: "integration",
        description: "Needs external services such as Postgres.",
        timeout: 30_000,
      },
      {
        name: "property",
        description: "Property-based: checks guarantees against generated inputs.",
      },
      {
        name: "critical",
        description: "A failure that wouldn't be caught easily without running these tests and is critical for the core functionality.",
      },
    ],
  },
});
