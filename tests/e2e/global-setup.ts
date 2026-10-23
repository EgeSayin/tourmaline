import { execSync } from "node:child_process";
import postgres from "postgres";
import { E2E_ACCOUNT } from "./helpers";

/**
 * Recreates the e2e database's contents: migrations, and the one account with the sample week, sign-up closed.
 */
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
  const e2e = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  try {
    // Accounts a spec created, with their workspaces.
    await e2e`delete from workspaces where id in (select workspace_id from users where username <> ${E2E_ACCOUNT.username})`;
    await e2e`update instance set sign_up_open = false`;
    await e2e`update users set failed_sign_ins = 0, sign_in_paused_until = null`;
  } finally {
    await e2e.end();
  }
  execSync(`npm run db:seed -- ${E2E_ACCOUNT.username} ${E2E_ACCOUNT.password}`, { env, stdio: "ignore" });
}
