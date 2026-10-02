import { TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { test } from "vitest";
import { createDatabase, type Database, type Transaction } from "@/server/db/connection";

const MIGRATION_LOCK_ID = 727_001;

async function prepareTestDatabase(adminUrl: string, testUrl: string) {
  const name = new URL(testUrl).pathname.slice(1);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error; // duplicate_database
  } finally {
    await admin.end();
  }

  // Workers run in parallel; the advisory lock makes them apply migrations one at a time.
  const migrator = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await migrator`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    await migrate(drizzle(migrator), { migrationsFolder: "drizzle" });
  } finally {
    await migrator.end();
  }
}

/**
 * Vitest `test` with lazy database fixtures; tests that don't use them never connect.
 * `tx` is a transaction that is rolled back after the test.
 */
export const dbTest = test.extend<{ $worker: { db: Database }; $test: { tx: Transaction } }>({
  db: [
    async ({}, use) => {
      const adminUrl = process.env.DATABASE_URL;
      const testUrl = process.env.TEST_DATABASE_URL;
      if (!adminUrl || !testUrl) throw new Error("DATABASE_URL and TEST_DATABASE_URL must be set for integration tests");

      await prepareTestDatabase(adminUrl, testUrl);
      const client = postgres(testUrl, { onnotice: () => {} });
      await use(createDatabase(client));
      await client.end();
    },
    { scope: "worker" },
  ],
  tx: async ({ db }, use) => {
    await db
      .transaction(async (tx) => {
        await use(tx);
        tx.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });
  },
});
