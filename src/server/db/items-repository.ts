import { and, eq, gte, type SQL } from "drizzle-orm";
import type { Item, NewItem } from "@/lib/items";
import type { Executor, Transaction } from "./connection";
import { items, occurrenceOverrides } from "./schema";

export async function insertItem(executor: Executor, item: NewItem): Promise<string> {
  const [{ id }] = await executor.insert(items).values(toRow(item)).returning({ id: items.id });
  return id;
}

/** Returns `false` if no item has `id`. */
export async function updateItem(executor: Executor, id: string, item: NewItem): Promise<boolean> {
  const updated = await executor.update(items).set(toRow(item)).where(eq(items.id, id)).returning({ id: items.id });
  return updated.length > 0;
}

/** Returns `false` if no item has `id`. */
export async function deleteItem(executor: Executor, id: string): Promise<boolean> {
  const deleted = await executor.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  return deleted.length > 0;
}

export function loadItems(executor: Executor): Promise<Item[]> {
  return findItems(executor);
}

export async function loadItem(executor: Executor, id: string): Promise<Item | undefined> {
  const [item] = await findItems(executor, eq(items.id, id));
  return item;
}

export async function setItemDone(executor: Executor, id: string, done: boolean): Promise<void> {
  await executor.update(items).set({ done }).where(eq(items.id, id));
}

export async function setOccurrenceDone(
  executor: Executor,
  itemId: string,
  date: string,
  done: boolean,
): Promise<void> {
  await executor
    .insert(occurrenceOverrides)
    .values({ itemId, occurrenceDate: date, done })
    .onConflictDoUpdate({ target: [occurrenceOverrides.itemId, occurrenceOverrides.occurrenceDate], set: { done } });
}

export async function skipOccurrence(executor: Executor, itemId: string, date: string): Promise<void> {
  await executor
    .insert(occurrenceOverrides)
    .values({ itemId, occurrenceDate: date, skipped: true })
    .onConflictDoUpdate({
      target: [occurrenceOverrides.itemId, occurrenceOverrides.occurrenceDate],
      set: { skipped: true },
    });
}

export async function deleteOverrides(tx: Transaction, itemId: string): Promise<void> {
  await tx.delete(occurrenceOverrides).where(eq(occurrenceOverrides.itemId, itemId));
}

/** Moves `fromId`'s occurrence overrides dated `fromDate` or later to `toId`. */
export async function moveOverrides(tx: Transaction, fromId: string, toId: string, fromDate: string): Promise<void> {
  await tx
    .update(occurrenceOverrides)
    .set({ itemId: toId })
    .where(and(eq(occurrenceOverrides.itemId, fromId), gte(occurrenceOverrides.occurrenceDate, fromDate)));
}

async function findItems(executor: Executor, where?: SQL): Promise<Item[]> {
  const rows = await executor.query.items.findMany({
    where,
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
