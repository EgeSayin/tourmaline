import { and, eq, sql } from "drizzle-orm";
import type { FixedItem, Item, NewFixedItem, NewItem, NewTask, Task } from "@/lib/items";
import type { Occurrences } from "@/lib/recurrence";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { categories, fixedItems, tasks } from "./schema";

export async function insertItem(tx: WorkspaceTx, item: NewItem, occurrences: Occurrences = {}): Promise<string> {
  const values = { workspaceId: tx.workspaceId, occurrences };
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
  return id;
}

/** Saves `item` over the stored item `id`, which must be of the same kind. */
export async function updateItem(tx: WorkspaceTx, id: string, item: NewItem, occurrences: Occurrences): Promise<void> {
  if (item.timing === "fixed") {
    await tx
      .update(fixedItems)
      .set({ ...fixedRow(tx, item), occurrences })
      .where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, id)));
  } else {
    await tx
      .update(tasks)
      .set({ ...taskRow(tx, item), occurrences })
      .where(and(ownedBy(tx, tasks), eq(tasks.id, id)));
  }
}

export async function setOccurrences(tx: WorkspaceTx, item: Item, occurrences: Occurrences): Promise<void> {
  if (item.timing === "fixed") {
    await tx
      .update(fixedItems)
      .set({ occurrences })
      .where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, item.id)));
  } else {
    await tx
      .update(tasks)
      .set({ occurrences })
      .where(and(ownedBy(tx, tasks), eq(tasks.id, item.id)));
  }
}

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
  const [fixedRows, taskRows] = await Promise.all([
    tx.select().from(fixedItems).where(ownedBy(tx, fixedItems)),
    tx.select().from(tasks).where(ownedBy(tx, tasks)),
  ]);
  return [...fixedRows.map(toFixedItem), ...taskRows.map(toTask)];
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
  return fixedRow ? toFixedItem(fixedRow) : taskRow && toTask(taskRow);
}

/** A category deleted meanwhile, or another workspace's, is saved as none, as deleting it later would leave it. */
function sharedRow(tx: WorkspaceTx, { title, priority, recurrence, categoryId }: NewItem) {
  return { title, priority, recurrence, categoryId: categoryId && categoryInWorkspace(tx, categoryId) };
}

const categoryInWorkspace = (tx: WorkspaceTx, id: string) =>
  sql<string>`(select ${categories.id} from ${categories} where ${and(ownedBy(tx, categories), eq(categories.id, id))})`;

function fixedRow(tx: WorkspaceTx, item: NewFixedItem) {
  const { start, end, location, bufferBeforeMin, bufferAfterMin } = item;
  return { ...sharedRow(tx, item), startAt: start, endAt: end, location, bufferBeforeMin, bufferAfterMin };
}

function taskRow(tx: WorkspaceTx, item: NewTask) {
  const { durationMin, earliestStart, deadline, split, spread } = item;
  return {
    ...sharedRow(tx, item),
    durationMin,
    earliestStart,
    deadline,
    splitMinChunkMin: split?.minChunkMin ?? null,
    splitMaxChunkMin: split?.maxChunkMin ?? null,
    spread,
  };
}

function toFixedItem(row: typeof fixedItems.$inferSelect): FixedItem {
  const { id, title, priority, recurrence, occurrences, categoryId, location, bufferBeforeMin, bufferAfterMin } = row;
  return {
    id,
    title,
    priority,
    timing: "fixed",
    recurrence,
    occurrences,
    categoryId,
    start: row.startAt,
    end: row.endAt,
    location,
    bufferBeforeMin,
    bufferAfterMin,
  };
}

function toTask(row: typeof tasks.$inferSelect): Task {
  const { id, title, priority, recurrence, occurrences, categoryId, durationMin, earliestStart, deadline } = row;
  return {
    id,
    title,
    priority,
    timing: "flexible",
    recurrence,
    occurrences,
    categoryId,
    durationMin,
    earliestStart,
    deadline,
    split:
      row.splitMinChunkMin === null || row.splitMaxChunkMin === null
        ? null
        : { minChunkMin: row.splitMinChunkMin, maxChunkMin: row.splitMaxChunkMin },
    spread: row.spread,
    done: row.done,
  };
}
