import { and, eq, sql } from "drizzle-orm";
import type { FixedItem, Item, NewFixedItem, NewItem, NewTask, Task } from "@/lib/items";
import type { OccurrenceChange, OccurrenceChanges, Occurrences, OccurrenceState } from "@/lib/recurrence";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { categories, fixedItemOccurrences, fixedItems, taskOccurrences, tasks } from "./schema";

export async function insertItem(
  tx: WorkspaceTx,
  item: NewItem,
  occurrences: Occurrences = {},
  changes: OccurrenceChanges = {},
): Promise<string> {
  const values = { workspaceId: tx.workspaceId };
  const [{ id }] =
    item.timing === "fixed"
      ? await tx
          .insert(fixedItems)
          .values({ ...fixedRow(tx, item), ...values })
          .returning({ id: fixedItems.id })
      : await tx
          .insert(tasks)
          .values({ ...taskRow(tx, item), ...values })
          .returning({ id: tasks.id });
  await insertOccurrences(tx, item.timing, id, occurrences, changes);
  return id;
}

/** Saves `item` over the stored item `id`, which must be of the same kind, with these occurrences instead of its own. */
export async function updateItem(
  tx: WorkspaceTx,
  id: string,
  item: NewItem,
  occurrences: Occurrences,
  changes: OccurrenceChanges,
): Promise<void> {
  if (item.timing === "fixed") {
    await tx
      .update(fixedItems)
      .set(fixedRow(tx, item))
      .where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, id)));
    await tx
      .delete(fixedItemOccurrences)
      .where(and(ownedBy(tx, fixedItemOccurrences), eq(fixedItemOccurrences.itemId, id)));
  } else {
    await tx
      .update(tasks)
      .set(taskRow(tx, item))
      .where(and(ownedBy(tx, tasks), eq(tasks.id, id)));
    await tx.delete(taskOccurrences).where(and(ownedBy(tx, taskOccurrences), eq(taskOccurrences.itemId, id)));
  }
  await insertOccurrences(tx, item.timing, id, occurrences, changes);
}

/**
 * Sets the state or the change of series `item`'s occurrence on local date `date`, or with `null` clears it; what
 * `update` leaves out stays as it is.
 */
export async function saveOccurrence(
  tx: WorkspaceTx,
  item: Item,
  date: string,
  update: { state?: OccurrenceState | null; change?: OccurrenceChange | null },
): Promise<void> {
  const state = "state" in update ? (update.state ?? null) : (item.occurrences[date] ?? null);
  const change = "change" in update ? (update.change ?? null) : (item.changes[date] ?? null);
  const table = item.timing === "fixed" ? fixedItemOccurrences : taskOccurrences;
  await tx.delete(table).where(and(ownedBy(tx, table), eq(table.itemId, item.id), eq(table.date, date)));
  if (state || change) {
    await insertOccurrences(tx, item.timing, item.id, state ? { [date]: state } : {}, change ? { [date]: change } : {});
  }
}

async function insertOccurrences(
  tx: WorkspaceTx,
  timing: Item["timing"],
  itemId: string,
  occurrences: Occurrences,
  changes: OccurrenceChanges,
): Promise<void> {
  const rows = [...new Set([...Object.keys(occurrences), ...Object.keys(changes)])].map((date) => ({
    workspaceId: tx.workspaceId,
    itemId,
    date,
    state: occurrences[date] ?? null,
    startAt: changes[date]?.start ?? null,
    endAt: changes[date]?.end ?? null,
  }));
  if (rows.length === 0) return;
  if (timing === "fixed") await tx.insert(fixedItemOccurrences).values(rows);
  else {
    const withDurations = rows.map((row) => ({ ...row, durationMin: changes[row.date]?.durationMin ?? null }));
    await tx.insert(taskOccurrences).values(withDurations);
  }
}

type OccurrenceRow = typeof fixedItemOccurrences.$inferSelect & { durationMin?: number | null };

/** The occurrence states and changes in `rows`, by item id. */
function groupOccurrences(
  rows: OccurrenceRow[],
): Map<string, { occurrences: Occurrences; changes: OccurrenceChanges }> {
  const byItem = new Map<string, { occurrences: Occurrences; changes: OccurrenceChanges }>();
  for (const row of rows) {
    const entry = byItem.get(row.itemId) ?? { occurrences: {}, changes: {} };
    if (row.state) entry.occurrences[row.date] = row.state;
    if (row.startAt && row.endAt) {
      entry.changes[row.date] = { start: row.startAt, end: row.endAt, durationMin: row.durationMin ?? null };
    }
    byItem.set(row.itemId, entry);
  }
  return byItem;
}

const NO_OCCURRENCES = { occurrences: {}, changes: {} };

export async function setItemDone(tx: WorkspaceTx, id: string, done: boolean): Promise<void> {
  await tx
    .update(tasks)
    .set({ done })
    .where(and(ownedBy(tx, tasks), eq(tasks.id, id)));
}

/** Deletes `item` and, for a task, its placements. */
export async function deleteItem(tx: WorkspaceTx, item: Item): Promise<void> {
  if (item.timing === "fixed") {
    await tx.delete(fixedItems).where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, item.id)));
  } else {
    await tx.delete(tasks).where(and(ownedBy(tx, tasks), eq(tasks.id, item.id)));
  }
}

export async function loadItems(tx: WorkspaceTx): Promise<Item[]> {
  const [fixedRows, taskRows, fixedOccurrenceRows, taskOccurrenceRows] = await Promise.all([
    tx.select().from(fixedItems).where(ownedBy(tx, fixedItems)),
    tx.select().from(tasks).where(ownedBy(tx, tasks)),
    tx.select().from(fixedItemOccurrences).where(ownedBy(tx, fixedItemOccurrences)),
    tx.select().from(taskOccurrences).where(ownedBy(tx, taskOccurrences)),
  ]);
  const fixedHistory = groupOccurrences(fixedOccurrenceRows);
  const taskHistory = groupOccurrences(taskOccurrenceRows);
  return [
    ...fixedRows.map((row) => toFixedItem(row, fixedHistory.get(row.id) ?? NO_OCCURRENCES)),
    ...taskRows.map((row) => toTask(row, taskHistory.get(row.id) ?? NO_OCCURRENCES)),
  ];
}

export async function loadItem(tx: WorkspaceTx, id: string): Promise<Item | undefined> {
  const [[fixedRow], [taskRow]] = await Promise.all([
    tx
      .select()
      .from(fixedItems)
      .where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, id))),
    tx
      .select()
      .from(tasks)
      .where(and(ownedBy(tx, tasks), eq(tasks.id, id))),
  ]);
  if (fixedRow) {
    const rows = await tx
      .select()
      .from(fixedItemOccurrences)
      .where(and(ownedBy(tx, fixedItemOccurrences), eq(fixedItemOccurrences.itemId, id)));
    return toFixedItem(fixedRow, groupOccurrences(rows).get(id) ?? NO_OCCURRENCES);
  }
  if (!taskRow) return undefined;
  const rows = await tx
    .select()
    .from(taskOccurrences)
    .where(and(ownedBy(tx, taskOccurrences), eq(taskOccurrences.itemId, id)));
  return toTask(taskRow, groupOccurrences(rows).get(id) ?? NO_OCCURRENCES);
}

/** A category deleted meanwhile, or another workspace's, is saved as none, as deleting it later would leave it. */
function sharedRow(tx: WorkspaceTx, { title, priority, recurrence, categoryId }: NewItem) {
  return { title, priority, recurrence, categoryId: categoryId && categoryInWorkspace(tx, categoryId) };
}

const categoryInWorkspace = (tx: WorkspaceTx, id: string) =>
  sql<string>`(select ${categories.id} from ${categories} where ${and(ownedBy(tx, categories), eq(categories.id, id))})`;

function fixedRow(tx: WorkspaceTx, item: NewFixedItem) {
  const { start, end, dayTimes, location, bufferBeforeMin, bufferAfterMin } = item;
  return { ...sharedRow(tx, item), startAt: start, endAt: end, dayTimes, location, bufferBeforeMin, bufferAfterMin };
}

function taskRow(tx: WorkspaceTx, item: NewTask) {
  const { durationMin, dayDurations, earliestStart, deadline, split, spread, withinPeriod, upTo, totalMin, timeOfDay } =
    item;
  return {
    ...sharedRow(tx, item),
    durationMin,
    dayDurations,
    earliestStart,
    deadline,
    splitMinChunkMin: split?.minChunkMin ?? null,
    splitMaxChunkMin: split?.maxChunkMin ?? null,
    splitBreakMin: split?.breakMin ?? null,
    spread,
    withinPeriod,
    upTo,
    totalMin,
    timeOfDayStartMin: timeOfDay?.startMinute ?? null,
    timeOfDayEndMin: timeOfDay?.endMinute ?? null,
    timeOfDayMust: timeOfDay?.must ?? null,
  };
}

type History = { occurrences: Occurrences; changes: OccurrenceChanges };

function toFixedItem(row: typeof fixedItems.$inferSelect, { occurrences, changes }: History): FixedItem {
  const { id, title, priority, recurrence, categoryId, dayTimes, location, bufferBeforeMin, bufferAfterMin } = row;
  return {
    id,
    title,
    priority,
    timing: "fixed",
    recurrence,
    occurrences,
    changes,
    categoryId,
    start: row.startAt,
    end: row.endAt,
    dayTimes,
    location,
    bufferBeforeMin,
    bufferAfterMin,
  };
}

function toTask(row: typeof tasks.$inferSelect, { occurrences, changes }: History): Task {
  const { id, title, priority, recurrence, categoryId, durationMin, dayDurations, earliestStart, deadline } = row;
  return {
    id,
    title,
    priority,
    timing: "flexible",
    recurrence,
    occurrences,
    changes,
    categoryId,
    durationMin,
    dayDurations,
    earliestStart,
    deadline,
    split:
      row.splitMinChunkMin === null || row.splitMaxChunkMin === null || row.splitBreakMin === null
        ? null
        : { minChunkMin: row.splitMinChunkMin, maxChunkMin: row.splitMaxChunkMin, breakMin: row.splitBreakMin },
    spread: row.spread,
    withinPeriod: row.withinPeriod,
    upTo: row.upTo,
    totalMin: row.totalMin,
    timeOfDay:
      row.timeOfDayStartMin === null || row.timeOfDayEndMin === null || row.timeOfDayMust === null
        ? null
        : { startMinute: row.timeOfDayStartMin, endMinute: row.timeOfDayEndMin, must: row.timeOfDayMust },
    done: row.done,
  };
}
