import "server-only";
import { and, eq, gte, type SQL } from "drizzle-orm";
import type { Item, NewItem } from "@/lib/items";
import type { Database, Transaction } from "./connection";
import { fixedItemDetails, flexibleItemDetails, items, occurrenceOverrides } from "./schema";

/** Inserts the item and its details row; requiring a transaction keeps the two from being written separately. */
export async function insertItem(tx: Transaction, item: NewItem): Promise<string> {
  const [{ id }] = await tx
    .insert(items)
    .values({ title: item.title, priority: item.priority, timing: item.timing, recurrence: item.recurrence })
    .returning({ id: items.id });

  await insertDetails(tx, id, item);
  return id;
}

/**
 * Replaces the item's fields and details, including switching between fixed and flexible. Its placements and
 * overrides are left as they are; an item with placements can't become fixed. Returns `false` if no item has `id`.
 */
export async function updateItem(tx: Transaction, id: string, item: NewItem): Promise<boolean> {
  await tx.delete(fixedItemDetails).where(eq(fixedItemDetails.itemId, id));
  await tx.delete(flexibleItemDetails).where(eq(flexibleItemDetails.itemId, id));

  const updated = await tx
    .update(items)
    .set({
      title: item.title,
      priority: item.priority,
      timing: item.timing,
      recurrence: item.recurrence,
    })
    .where(eq(items.id, id))
    .returning({ id: items.id });
  if (updated.length === 0) return false;

  await insertDetails(tx, id, item);
  return true;
}

/** Deletes the item and, through the cascade, its details. Returns `false` if no item has this `id`. */
export async function deleteItem(executor: Database | Transaction, id: string): Promise<boolean> {
  const deleted = await executor.delete(items).where(eq(items.id, id)).returning({ id: items.id });
  return deleted.length > 0;
}

async function insertDetails(tx: Transaction, itemId: string, item: NewItem) {
  if (item.timing === "fixed") {
    await tx.insert(fixedItemDetails).values({
      itemId,
      startAt: item.start,
      endAt: item.end,
      location: item.location,
      bufferBeforeMin: item.bufferBeforeMin,
      bufferAfterMin: item.bufferAfterMin,
    });
  } else {
    await tx.insert(flexibleItemDetails).values({
      itemId,
      durationMin: item.durationMin,
      earliestStart: item.earliestStart,
      deadline: item.deadline,
      splitMinChunkMin: item.split?.minChunkMin ?? null,
      splitMaxChunkMin: item.split?.maxChunkMin ?? null,
      spread: item.spread,
    });
  }
}

/** Every item with its details. Throws if an item's details row is missing. */
export function loadItems(executor: Database | Transaction): Promise<Item[]> {
  return findItems(executor);
}

/** The item with this `id`, or `undefined` if there is none. Throws if its details row is missing. */
export async function loadItem(executor: Database | Transaction, id: string): Promise<Item | undefined> {
  const [item] = await findItems(executor, eq(items.id, id));
  return item;
}

/** Marks the occurrence of `itemId` on local date `date` as skipped. */
export async function skipOccurrence(executor: Database | Transaction, itemId: string, date: string): Promise<void> {
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

async function findItems(executor: Database | Transaction, where?: SQL): Promise<Item[]> {
  const rows = await executor.query.items.findMany({
    where,
    with: {
      fixedDetails: true,
      flexibleDetails: true,
      overrides: { orderBy: (override, { asc }) => [asc(override.occurrenceDate)] },
    },
  });

  return rows.map(({ id, title, priority, timing, recurrence, overrides, fixedDetails, flexibleDetails }): Item => {
    const shared = {
      id,
      title,
      priority,
      recurrence,
      overrides: overrides.map(({ occurrenceDate, skipped }) => ({ date: occurrenceDate, skipped })),
    };
    if (timing === "fixed") {
      if (!fixedDetails) throw new Error(`Fixed item ${id} has no details row`);
      return {
        ...shared,
        timing,
        start: fixedDetails.startAt,
        end: fixedDetails.endAt,
        location: fixedDetails.location,
        bufferBeforeMin: fixedDetails.bufferBeforeMin,
        bufferAfterMin: fixedDetails.bufferAfterMin,
      };
    }

    if (!flexibleDetails) throw new Error(`Flexible item ${id} has no details row`);
    const { splitMinChunkMin, splitMaxChunkMin } = flexibleDetails;
    return {
      ...shared,
      timing,
      durationMin: flexibleDetails.durationMin,
      earliestStart: flexibleDetails.earliestStart,
      deadline: flexibleDetails.deadline,
      split:
        splitMinChunkMin !== null && splitMaxChunkMin !== null
          ? { minChunkMin: splitMinChunkMin, maxChunkMin: splitMaxChunkMin }
          : null,
      spread: flexibleDetails.spread,
    };
  });
}
