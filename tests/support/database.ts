import { TransactionRollbackError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { test } from "vitest";
import { createDatabase, type Database } from "@/server/db/connection";
import { PERSONAL_WORKSPACE_ID, type WorkspaceTx } from "@/server/db/workspace-transaction";

const MIGRATION_LOCK_ID = 727_001;

async function prepareTestDatabase(adminUrl: string, testUrl: string) {
  const name = new URL(testUrl).pathname.slice(1);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`create database "${name}"`);
  } catch (error) {
    // duplicate_database, or unique_violation when another worker creates it at the same moment
    if (!["42P04", "23505"].includes((error as { code?: string }).code ?? "")) throw error;
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
 * `tx` is a transaction in the personal workspace that is rolled back after the test.
 */
export const dbTest = test.extend<{ $worker: { db: Database }; $test: { tx: WorkspaceTx } }>({
  db: [
    async ({}, use) => {
      const adminUrl = process.env.DATABASE_URL;
      const testUrl = process.env.TEST_DATABASE_URL;
      if (!adminUrl || !testUrl)
        throw new Error("DATABASE_URL and TEST_DATABASE_URL must be set for integration tests");

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
        await use(Object.assign(tx, { workspaceId: PERSONAL_WORKSPACE_ID }));
        tx.rollback();
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError)) throw error;
      });
  },
});

/**
 * A savepoint in `tx`, so a failing statement can be expected without aborting `tx`, working in `workspaceId`
 * (default: `tx`'s).
 */
export function savepoint<T>(
  tx: WorkspaceTx,
  work: (inner: WorkspaceTx) => Promise<T>,
  workspaceId = tx.workspaceId,
): Promise<T> {
  return tx.transaction((inner) => work(Object.assign(inner, { workspaceId })));
}
