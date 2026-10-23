import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Any id, as long as nothing else takes this advisory lock. */
const MIGRATION_LOCK_ID = 727_000;

/**
 * Applies the pending migrations in `MIGRATIONS_DIR` (default: `drizzle`), all in one transaction. The lock makes a
 * second run wait instead of applying them twice.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    await migrate(drizzle(client), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "drizzle" });
    console.log("Migrations applied.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
