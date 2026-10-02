import "server-only";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import type { Placement } from "@/lib/placements";
import type { Interval } from "@/server/scheduler/intervals";
import type { Database, Transaction } from "./connection";
import { placements } from "./schema";

/** Placements overlapping `range`, sorted by start. */
export async function loadPlacements(executor: Database | Transaction, range: Interval): Promise<Placement[]> {
  const rows = await executor
    .select()
    .from(placements)
    .where(and(lt(placements.startAt, range.end), gt(placements.endAt, range.start)))
    .orderBy(asc(placements.startAt));

  return rows.map((row) => ({
    itemId: row.itemId,
    start: row.startAt,
    end: row.endAt,
    source: row.source,
    pinned: row.pinned,
  }));
}

export async function insertPlacements(executor: Database | Transaction, toInsert: Placement[]): Promise<void> {
  if (toInsert.length === 0) return;
  await executor.insert(placements).values(
    toInsert.map((placement) => ({
      itemId: placement.itemId,
      startAt: placement.start,
      endAt: placement.end,
      source: placement.source,
      pinned: placement.pinned,
    })),
  );
}

/**
 * Replaces the pending placements (unpinned, starting in `range` at or after `from`) with those among `next`.
 * Started and pinned placements are left untouched.
 */
export async function replacePendingPlacements(
  tx: Transaction,
  range: Interval,
  from: Date,
  next: Placement[],
): Promise<void> {
  const isPending = (start: Date, pinned: boolean) => !pinned && start >= from && start < range.end;
  await tx
    .delete(placements)
    .where(and(eq(placements.pinned, false), gte(placements.startAt, from), lt(placements.startAt, range.end)));
  await insertPlacements(
    tx,
    next.filter((placement) => isPending(placement.start, placement.pinned)),
  );
}
