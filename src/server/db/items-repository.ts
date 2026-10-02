import "server-only";
import { and, eq, gte } from "drizzle-orm";
import type { Item, NewItem } from "@/lib/items";
import type { Database, Transaction } from "./connection";
import { fixedItemDetails, flexibleItemDetails, items, placements } from "./schema";

/** Inserts the item and its details row; requiring a transaction keeps the two from being written separately. */
export async function insertItem(tx: Transaction, item: NewItem): Promise<string> {
  const [{ id }] = await tx
    .insert(items)
    .values({ title: item.title, priority: item.priority, timing: item.timing })
    .returning({ id: items.id });

  await insertDetails(tx, id, item);
  return id;
}

/**
 * Replaces the item's fields and details, including switching between fixed and flexible.
 * A flexible task keeps its started and pinned placements, so time already spent on it still counts, and
 * loses the rest to be placed again. An item that becomes fixed loses all of them.
 * Returns `false` if no item has this `id`.
 */
export async function updateItem(tx: Transaction, id: string, item: NewItem, now: Date): Promise<boolean> {
  // Rows referencing the item go first: their composite foreign keys block changing `timing`.
  const pending = and(eq(placements.pinned, false), gte(placements.startAt, now));
  await tx.delete(placements).where(and(eq(placements.itemId, id), item.timing === "fixed" ? undefined : pending));
  await tx.delete(fixedItemDetails).where(eq(fixedItemDetails.itemId, id));
  await tx.delete(flexibleItemDetails).where(eq(flexibleItemDetails.itemId, id));

  const updated = await tx
    .update(items)
    .set({ title: item.title, priority: item.priority, timing: item.timing })
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
      preferredWindows: item.preferredWindows,
      spread: item.spread,
    });
  }
}

/** Every item with its details. Throws if an item's details row is missing. */
export async function loadItems(executor: Database | Transaction): Promise<Item[]> {
  const rows = await executor.query.items.findMany({ with: { fixedDetails: true, flexibleDetails: true } });

  return rows.map(({ id, title, priority, timing, fixedDetails, flexibleDetails }): Item => {
    if (timing === "fixed") {
      if (!fixedDetails) throw new Error(`Fixed item ${id} has no details row`);
      return {
        id,
        title,
        priority,
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
      id,
      title,
      priority,
      timing,
      durationMin: flexibleDetails.durationMin,
      earliestStart: flexibleDetails.earliestStart,
      deadline: flexibleDetails.deadline,
      split:
        splitMinChunkMin !== null && splitMaxChunkMin !== null
          ? { minChunkMin: splitMinChunkMin, maxChunkMin: splitMaxChunkMin }
          : null,
      preferredWindows: flexibleDetails.preferredWindows,
      spread: flexibleDetails.spread,
    };
  });
}
