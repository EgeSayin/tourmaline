import { and, asc, eq, gt, gte, isNull, lt, lte, type SQL } from "drizzle-orm";
import { isPending, type Placement, type PlacementRef } from "@/lib/placements";
import { occurrenceId, parseOccurrenceId } from "@/lib/recurrence";
import type { Interval } from "@/lib/time/interval";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { placements } from "./schema";

/** Placements overlapping `range`, sorted by start. */
export function loadPlacements(tx: WorkspaceTx, range: Interval): Promise<Placement[]> {
  return findPlacements(tx, and(lt(placements.startAt, range.end), gt(placements.endAt, range.start)));
}

/** Placements that end after `start`, sorted by start. */
export function loadPlacementsFrom(tx: WorkspaceTx, start: Date): Promise<Placement[]> {
  return findPlacements(tx, gt(placements.endAt, start));
}

async function findPlacements(tx: WorkspaceTx, where: SQL | undefined): Promise<Placement[]> {
  const rows = await tx
    .select()
    .from(placements)
    .where(and(ownedBy(tx, placements), where))
    .orderBy(asc(placements.startAt));
  return rows.map(toPlacement);
}

/** Planned placements that ended by `now`, waiting to be reviewed, sorted by start. */
export async function loadPlacementsToReview(tx: WorkspaceTx, now: Date): Promise<Placement[]> {
  const rows = await tx
    .select()
    .from(placements)
    .where(and(ownedBy(tx, placements), eq(placements.status, "planned"), lte(placements.endAt, now)))
    .orderBy(asc(placements.startAt));
  return rows.map(toPlacement);
}

/** Every placement of a task or occurrence (by its occurrence id), sorted by start. */
export async function loadTaskPlacements(tx: WorkspaceTx, taskId: string): Promise<Placement[]> {
  const rows = await tx.select().from(placements).where(ofTask(tx, taskId)).orderBy(asc(placements.startAt));
  return rows.map(toPlacement);
}

export async function loadPlacement(tx: WorkspaceTx, ref: PlacementRef): Promise<Placement | undefined> {
  const [row] = await tx.select().from(placements).where(matching(tx, ref));
  return row && toPlacement(row);
}

export async function updatePlacement(
  tx: WorkspaceTx,
  ref: PlacementRef,
  changes: Partial<Pick<Placement, "status" | "pinned">>,
): Promise<void> {
  await tx.update(placements).set(changes).where(matching(tx, ref));
}

/** Checks off the task's planned placements that started before `now`. */
export async function checkOffStarted(tx: WorkspaceTx, taskId: string, now: Date): Promise<void> {
  await tx
    .update(placements)
    .set({ status: "done" })
    .where(and(ofTask(tx, taskId), eq(placements.status, "planned"), lt(placements.startAt, now)));
}

/** Deletes the task's planned placements from `now` on, pinned ones too, once it is no longer planned. */
export async function dropPlanned(tx: WorkspaceTx, taskId: string, now: Date): Promise<void> {
  await tx.delete(placements).where(and(ofTask(tx, taskId), plannedFrom(now)));
}

/** Like `dropPlanned`, for every occurrence of series `itemId` on local date `fromDate` or later. */
export async function dropPlannedOccurrences(
  tx: WorkspaceTx,
  itemId: string,
  fromDate: string,
  now: Date,
): Promise<void> {
  await tx
    .delete(placements)
    .where(
      and(
        ownedBy(tx, placements),
        eq(placements.itemId, itemId),
        gte(placements.occurrenceDate, fromDate),
        plannedFrom(now),
      ),
    );
}

function ofTask(tx: WorkspaceTx, taskId: string) {
  const { itemId, date } = parseOccurrenceId(taskId);
  return and(
    ownedBy(tx, placements),
    eq(placements.itemId, itemId),
    date ? eq(placements.occurrenceDate, date) : isNull(placements.occurrenceDate),
  );
}

function matching(tx: WorkspaceTx, { taskId, start }: PlacementRef) {
  return and(ofTask(tx, taskId), eq(placements.startAt, start));
}

function toPlacement(row: typeof placements.$inferSelect): Placement {
  return {
    taskId: row.occurrenceDate ? occurrenceId(row.itemId, row.occurrenceDate) : row.itemId,
    start: row.startAt,
    end: row.endAt,
    pinned: row.pinned,
    status: row.status,
  };
}

export async function insertPlacements(tx: WorkspaceTx, toInsert: Placement[]): Promise<void> {
  if (toInsert.length === 0) return;
  await tx.insert(placements).values(
    toInsert.map((placement) => {
      const { itemId, date } = parseOccurrenceId(placement.taskId);
      return {
        workspaceId: tx.workspaceId,
        itemId,
        occurrenceDate: date,
        startAt: placement.start,
        endAt: placement.end,
        pinned: placement.pinned,
        status: placement.status,
      };
    }),
  );
}

/** Deletes the item's placements; with `from`, only the pending ones (see `isPending`) as of then. */
export async function deletePlacements(tx: WorkspaceTx, itemId: string, from?: Date): Promise<void> {
  await tx
    .delete(placements)
    .where(and(ownedBy(tx, placements), eq(placements.itemId, itemId), from && pendingAt(from)));
}

/** Moves the placements of series `fromId`'s occurrences on local date `fromDate` or later to series `toId`. */
export async function moveOccurrencePlacements(
  tx: WorkspaceTx,
  fromId: string,
  toId: string,
  fromDate: string,
): Promise<void> {
  await tx
    .update(placements)
    .set({ itemId: toId })
    .where(and(ownedBy(tx, placements), eq(placements.itemId, fromId), gte(placements.occurrenceDate, fromDate)));
}

/** Replaces the pending placements (see `isPending`) as of `from` with those among `next`; others are untouched. */
export async function replacePendingPlacements(tx: WorkspaceTx, from: Date, next: Placement[]): Promise<void> {
  await tx.delete(placements).where(and(ownedBy(tx, placements), pendingAt(from)));
  await insertPlacements(
    tx,
    next.filter((placement) => isPending(placement, from)),
  );
}

function pendingAt(now: Date) {
  return and(plannedFrom(now), eq(placements.pinned, false));
}

function plannedFrom(now: Date) {
  return and(eq(placements.status, "planned"), gte(placements.startAt, now));
}
