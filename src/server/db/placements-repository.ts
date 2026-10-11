import "server-only";
import { and, asc, eq, gt, gte, isNull, lt, lte } from "drizzle-orm";
import { isPending, type Placement, type PlacementRef } from "@/lib/placements";
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
  return rows.map(toPlacement);
}

/** Planned placements that ended by `now`, waiting to be reviewed, sorted by start. */
export async function loadPlacementsToReview(executor: Database | Transaction, now: Date): Promise<Placement[]> {
  const rows = await executor
    .select()
    .from(placements)
    .where(and(eq(placements.status, "planned"), lte(placements.endAt, now)))
    .orderBy(asc(placements.startAt));
  return rows.map(toPlacement);
}

/** Every placement of a task or occurrence (by its occurrence id), sorted by start. */
export async function loadTaskPlacements(executor: Database | Transaction, taskId: string): Promise<Placement[]> {
  const rows = await executor.select().from(placements).where(ofTask(taskId)).orderBy(asc(placements.startAt));
  return rows.map(toPlacement);
}

/** The placement `ref` points to, or `undefined` if there is none. */
export async function loadPlacement(
  executor: Database | Transaction,
  ref: PlacementRef,
): Promise<Placement | undefined> {
  const [row] = await executor.select().from(placements).where(matching(ref));
  return row && toPlacement(row);
}

export async function updatePlacement(
  executor: Database | Transaction,
  ref: PlacementRef,
  changes: Partial<Pick<Placement, "status" | "pinned">>,
): Promise<void> {
  await executor.update(placements).set(changes).where(matching(ref));
}

/** Checks off the task's placements still to review as of `now`: planned and ended. */
export async function checkOffToReview(executor: Database | Transaction, taskId: string, now: Date): Promise<void> {
  await executor
    .update(placements)
    .set({ status: "done" })
    .where(and(ofTask(taskId), eq(placements.status, "planned"), lte(placements.endAt, now)));
}

function ofTask(taskId: string) {
  const { itemId, date } = parseOccurrenceId(taskId);
  return and(
    eq(placements.itemId, itemId),
    date ? eq(placements.occurrenceDate, date) : isNull(placements.occurrenceDate),
  );
}

function matching({ taskId, start }: PlacementRef) {
  return and(ofTask(taskId), eq(placements.startAt, start));
}

function toPlacement(row: typeof placements.$inferSelect): Placement {
  return {
    taskId: row.occurrenceDate ? occurrenceId(row.itemId, row.occurrenceDate) : row.itemId,
    start: row.startAt,
    end: row.endAt,
    source: row.source,
    pinned: row.pinned,
    status: row.status,
  };
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
        status: placement.status,
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
  return and(eq(placements.status, "planned"), eq(placements.pinned, false), gte(placements.startAt, now));
}
