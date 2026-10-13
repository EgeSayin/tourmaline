import { eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Database, Transaction } from "./connection";

/** Holds every row outside demo mode; created by a migration. */
export const PERSONAL_WORKSPACE_ID = "00000000-0000-4000-8000-000000000000";

const PLAN_LOCK_CLASS = 727_002;

/** A transaction that reads and writes only `workspaceId`'s rows. */
export type WorkspaceTx = Transaction & { readonly workspaceId: string };

/**
 * Runs `work` for `workspaceId` holding its plan lock, so no request saves a plan made from data another was
 * changing. Other workspaces plan meanwhile.
 */
export function inWorkspace<T>(db: Database, workspaceId: string, work: (tx: WorkspaceTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PLAN_LOCK_CLASS}, hashtext(${workspaceId}))`);
    return work(await enterWorkspace(tx, workspaceId));
  });
}

/**
 * `tx` held by the database to `workspaceId`'s rows, until it ends: as `workspace_user`, whose row-level policies
 * (`ownRows` in the schema) admit only that workspace's. `ownedBy` stays the first line.
 */
export async function enterWorkspace(tx: Transaction, workspaceId: string): Promise<WorkspaceTx> {
  await tx.execute(sql`select set_config('app.workspace_id', ${workspaceId}, true)`);
  await tx.execute(sql`set local role workspace_user`);
  return Object.assign(tx, { workspaceId });
}

/**
 * Runs `work`, which only reads, on one consistent snapshot of `workspaceId`'s rows, without waiting for its plan
 * lock.
 */
export function readInWorkspace<T>(
  db: Database,
  workspaceId: string,
  work: (tx: WorkspaceTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => work(await enterWorkspace(tx, workspaceId)), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

/** Limits a query to `tx`'s workspace. */
export function ownedBy(tx: WorkspaceTx, table: { workspaceId: PgColumn }): SQL {
  return eq(table.workspaceId, tx.workspaceId);
}
