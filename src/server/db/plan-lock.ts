import "server-only";
import { sql } from "drizzle-orm";
import type { Database, Transaction } from "./connection";

const PLAN_LOCK_ID = 727_002;

/**
 * Runs `work` in a transaction holding the plan lock. Requests that read items and placements, plan and save run one
 * at a time this way, so none saves a plan made from what another was changing.
 */
export function inPlanTransaction<T>(db: Database, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PLAN_LOCK_ID})`);
    return work(tx);
  });
}
