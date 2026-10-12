import { and, eq } from "drizzle-orm";
import type { FixedItem, Item, NewFixedItem, NewItem, NewTask, Task } from "@/lib/items";
import type { Occurrences } from "@/lib/recurrence";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { fixedItems, tasks } from "./schema";

export async function insertItem(tx: WorkspaceTx, item: NewItem, occurrences: Occurrences = {}): Promise<string> {
  const values = { workspaceId: tx.workspaceId, occurrences };
  const [{ id }] =
    item.timing === "fixed"
      ? await tx
          .insert(fixedItems)
          .values({ ...fixedRow(item), ...values })
          .returning({ id: fixedItems.id })
      : await tx
          .insert(tasks)
          .values({ ...taskRow(item), ...values })
          .returning({ id: tasks.id });
  return id;
}

/** Saves `item` over the stored item `id`, which must be of the same kind. */
export async function updateItem(tx: WorkspaceTx, id: string, item: NewItem, occurrences: Occurrences): Promise<void> {
  if (item.timing === "fixed") {
    await tx
      .update(fixedItems)
      .set({ ...fixedRow(item), occurrences })
      .where(and(ownedBy(tx, fixedItems), eq(fixedItems.id, id)));
  } else {
    await tx
      .update(tasks)
      .set({ ...taskRow(item), occurrences })
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

const sharedRow = ({ title, priority, recurrence, categoryId }: NewItem) => ({
  title,
  priority,
  recurrence,
  categoryId,
});

function fixedRow(item: NewFixedItem) {
  const { start, end, location, bufferBeforeMin, bufferAfterMin } = item;
  return { ...sharedRow(item), startAt: start, endAt: end, location, bufferBeforeMin, bufferAfterMin };
}

function taskRow(item: NewTask) {
  const { durationMin, earliestStart, deadline, split, spread } = item;
  return {
    ...sharedRow(item),
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
