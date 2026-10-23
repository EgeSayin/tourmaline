import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { SIGNED_IN_STATE } from "./tests/e2e/helpers";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /\.setup\.ts$/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: SIGNED_IN_STATE },
      dependencies: ["setup"],
    },
    { name: "phone", use: { ...devices["Pixel 7"], storageState: SIGNED_IN_STATE }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    // A static file: the web server starts before globalSetup creates the database.
    url: `http://localhost:${PORT}/favicon.ico`,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL ?? "" },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
