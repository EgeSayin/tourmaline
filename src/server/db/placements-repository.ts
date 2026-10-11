import "server-only";
import { and, asc, eq, gt, gte, lt } from "drizzle-orm";
import { isPending, type Placement } from "@/lib/placements";
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
    done: row.done,
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
        done: placement.done,
      };
    }),
  );
}

/** Deletes the item's placements; with `from`, only the pending ones (see `isPending`) as of then. */
export async function deletePlacements(tx: Transaction, itemId: string, from?: Date): Promise<void> {
  await tx.delete(placements).where(and(eq(placements.itemId, itemId), from && pendingAt(from)));
}

/** Replaces the pending placements (see `isPending`) as of `from` with those among `next`; others are untouched. */
export async function replacePendingPlacements(tx: Transaction, from: Date, next: Placement[]): Promise<void> {
  await tx.delete(placements).where(pendingAt(from));
  await insertPlacements(
    tx,
    next.filter((placement) => isPending(placement, from)),
  );
}

function pendingAt(now: Date) {
  return and(eq(placements.pinned, false), eq(placements.done, false), gte(placements.startAt, now));
}
