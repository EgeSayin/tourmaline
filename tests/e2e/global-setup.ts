import { execSync } from "node:child_process";
import postgres from "postgres";

/** Recreates the e2e database's contents: migrations plus the sample week. */
export default async function globalSetup() {
  const adminUrl = process.env.DATABASE_URL;
  const e2eUrl = process.env.E2E_DATABASE_URL;
  if (!adminUrl || !e2eUrl) throw new Error("DATABASE_URL and E2E_DATABASE_URL must be set for e2e tests");

  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${new URL(e2eUrl).pathname.slice(1)}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error; // duplicate_database
  } finally {
    await admin.end();
  }

  const env = { ...process.env, DATABASE_URL: e2eUrl };
  execSync("npx drizzle-kit migrate", { env, stdio: "ignore" });
  execSync("npm run db:seed", { env, stdio: "ignore" });
}
