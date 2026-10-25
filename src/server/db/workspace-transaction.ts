import { eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Database, Transaction } from "./connection";

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

/**
 * Runs `work` in a savepoint of `tx`, and rolls its changes back unless `keep` says so of its result, which is
 * returned either way.
 */
export async function attempt<T>(
  tx: WorkspaceTx,
  work: (tx: WorkspaceTx) => Promise<T>,
  keep: (result: T) => boolean,
): Promise<T> {
  class Discarded {
    constructor(readonly result: T) {}
  }
  try {
    return await tx.transaction(async (inner) => {
      const result = await work(Object.assign(inner, { workspaceId: tx.workspaceId }));
      if (!keep(result)) throw new Discarded(result);
      return result;
    });
  } catch (error) {
    if (error instanceof Discarded) return error.result;
    throw error;
  }
}

/** Limits a query to `tx`'s workspace. */
export function ownedBy(tx: WorkspaceTx, table: { workspaceId: PgColumn }): SQL {
  return eq(table.workspaceId, tx.workspaceId);
}
