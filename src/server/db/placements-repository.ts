import "server-only";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import type { Placement } from "@/lib/placements";
import { occurrenceId, parseOccurrenceId } from "@/lib/recurrence";
import type { Interval } from "@/lib/time/interval";
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
    taskId: row.occurrenceDate ? occurrenceId(row.itemId, row.occurrenceDate) : row.itemId,
    start: row.startAt,
    end: row.endAt,
    source: row.source,
    pinned: row.pinned,
  }));
}

export async function insertPlacements(executor: Database | Transaction, toInsert: Placement[]): Promise<void> {
  if (toInsert.length === 0) return;
  await executor.insert(placements).values(
    toInsert.map((placement) => {
      const { itemId, date } = parseOccurrenceId(placement.taskId);
      return {
        itemId,
        occurrenceDate: date,
        startAt: placement.start,
        endAt: placement.end,
        source: placement.source,
        pinned: placement.pinned,
      };
    }),
  );
}

/** Deletes the item's placements; with `from`, only the pending ones (unpinned, starting then or later). */
export async function deletePlacements(tx: Transaction, itemId: string, from?: Date): Promise<void> {
  const pending = from && and(eq(placements.pinned, false), gte(placements.startAt, from));
  await tx.delete(placements).where(and(eq(placements.itemId, itemId), pending));
}

/**
 * Replaces the pending placements (unpinned, starting at `from` or later) with those among `next`.
 * Started and pinned placements are left untouched.
 */
export async function replacePendingPlacements(tx: Transaction, from: Date, next: Placement[]): Promise<void> {
  await tx.delete(placements).where(and(eq(placements.pinned, false), gte(placements.startAt, from)));
  await insertPlacements(
    tx,
    next.filter((placement) => !placement.pinned && placement.start >= from),
  );
}
