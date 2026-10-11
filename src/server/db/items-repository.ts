import { and, eq, gte, type SQL } from "drizzle-orm";
import type { Item, NewItem } from "@/lib/items";
import { ownedBy, type WorkspaceTx } from "./workspace-transaction";
import { items, occurrenceOverrides } from "./schema";

export async function insertItem(tx: WorkspaceTx, item: NewItem): Promise<string> {
  const [{ id }] = await tx
    .insert(items)
    .values({ ...toRow(item), workspaceId: tx.workspaceId })
    .returning({ id: items.id });
  return id;
}

/** Returns `false` if no item has `id`. */
export async function updateItem(tx: WorkspaceTx, id: string, item: NewItem): Promise<boolean> {
  const updated = await tx
    .update(items)
    .set(toRow(item))
    .where(and(ownedBy(tx, items), eq(items.id, id)))
    .returning({ id: items.id });
  return updated.length > 0;
}

/** Returns `false` if no item has `id`. */
export async function deleteItem(tx: WorkspaceTx, id: string): Promise<boolean> {
  const deleted = await tx
    .delete(items)
    .where(and(ownedBy(tx, items), eq(items.id, id)))
    .returning({ id: items.id });
  return deleted.length > 0;
}

export function loadItems(tx: WorkspaceTx): Promise<Item[]> {
  return findItems(tx);
}

export async function loadItem(tx: WorkspaceTx, id: string): Promise<Item | undefined> {
  const [item] = await findItems(tx, eq(items.id, id));
  return item;
}

export async function setItemDone(tx: WorkspaceTx, id: string, done: boolean): Promise<void> {
  await tx
    .update(items)
    .set({ done })
    .where(and(ownedBy(tx, items), eq(items.id, id)));
}

// Overrides go by item id: callers first load the item, which checks it is in their workspace.
export async function setOccurrenceDone(tx: WorkspaceTx, itemId: string, date: string, done: boolean): Promise<void> {
  await tx
    .insert(occurrenceOverrides)
    .values({ itemId, occurrenceDate: date, done })
    .onConflictDoUpdate({ target: [occurrenceOverrides.itemId, occurrenceOverrides.occurrenceDate], set: { done } });
}

export async function skipOccurrence(tx: WorkspaceTx, itemId: string, date: string): Promise<void> {
  await tx
    .insert(occurrenceOverrides)
    .values({ itemId, occurrenceDate: date, skipped: true })
    .onConflictDoUpdate({
      target: [occurrenceOverrides.itemId, occurrenceOverrides.occurrenceDate],
      set: { skipped: true },
    });
}

export async function deleteOverrides(tx: WorkspaceTx, itemId: string): Promise<void> {
  await tx.delete(occurrenceOverrides).where(eq(occurrenceOverrides.itemId, itemId));
}

/** Moves `fromId`'s occurrence overrides dated `fromDate` or later to `toId`. */
export async function moveOverrides(tx: WorkspaceTx, fromId: string, toId: string, fromDate: string): Promise<void> {
  await tx
    .update(occurrenceOverrides)
    .set({ itemId: toId })
    .where(and(eq(occurrenceOverrides.itemId, fromId), gte(occurrenceOverrides.occurrenceDate, fromDate)));
}

async function findItems(tx: WorkspaceTx, where?: SQL): Promise<Item[]> {
  const rows = await tx.query.items.findMany({
    where: and(ownedBy(tx, items), where),
    with: { overrides: { orderBy: (override, { asc }) => [asc(override.occurrenceDate)] } },
  });
  return rows.map(toItem);
}

const NO_FIXED = { startAt: null, endAt: null, location: null, bufferBeforeMin: null, bufferAfterMin: null };
const NO_TASK = {
  durationMin: null,
  earliestStart: null,
  deadline: null,
  splitMinChunkMin: null,
  splitMaxChunkMin: null,
  spread: null,
};

/** `item`'s columns, clearing the other kind's. */
function toRow(item: NewItem) {
  const { title, priority, timing, recurrence, categoryId } = item;
  const shared = { title, priority, timing, recurrence, categoryId };
  return item.timing === "fixed"
    ? {
        ...shared,
        ...NO_TASK,
        startAt: item.start,
        endAt: item.end,
        location: item.location,
        bufferBeforeMin: item.bufferBeforeMin,
        bufferAfterMin: item.bufferAfterMin,
      }
    : {
        ...shared,
        ...NO_FIXED,
        durationMin: item.durationMin,
        earliestStart: item.earliestStart,
        deadline: item.deadline,
        splitMinChunkMin: item.split?.minChunkMin ?? null,
        splitMaxChunkMin: item.split?.maxChunkMin ?? null,
        spread: item.spread,
      };
}

// The `!`s hold by the `items_kind` check.
function toItem(row: typeof items.$inferSelect & { overrides: (typeof occurrenceOverrides.$inferSelect)[] }): Item {
  const shared = {
    id: row.id,
    title: row.title,
    priority: row.priority,
    recurrence: row.recurrence,
    categoryId: row.categoryId,
    overrides: row.overrides.map(({ occurrenceDate, skipped, done }) => ({ date: occurrenceDate, skipped, done })),
  };
  if (row.timing === "fixed") {
    return {
      ...shared,
      timing: "fixed",
      start: row.startAt!,
      end: row.endAt!,
      location: row.location,
      bufferBeforeMin: row.bufferBeforeMin!,
      bufferAfterMin: row.bufferAfterMin!,
    };
  }
  return {
    ...shared,
    timing: "flexible",
    durationMin: row.durationMin!,
    earliestStart: row.earliestStart!,
    deadline: row.deadline!,
    split:
      row.splitMinChunkMin === null ? null : { minChunkMin: row.splitMinChunkMin, maxChunkMin: row.splitMaxChunkMin! },
    spread: row.spread!,
    done: row.done,
  };
}
