import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local itself; drizzle-kit runs outside Next.js and needs it loaded here.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
