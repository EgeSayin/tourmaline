import "server-only";
import type { Item, NewItem } from "@/lib/items";
import type { Database, Transaction } from "./connection";
import { fixedItemDetails, flexibleItemDetails, items } from "./schema";

/** Inserts the item and its details row; requiring a transaction keeps the two from being written separately. */
export async function insertItem(tx: Transaction, item: NewItem): Promise<string> {
  const [{ id }] = await tx
    .insert(items)
    .values({ title: item.title, priority: item.priority, timing: item.timing })
    .returning({ id: items.id });

  if (item.timing === "fixed") {
    await tx.insert(fixedItemDetails).values({
      itemId: id,
      startAt: item.start,
      endAt: item.end,
      location: item.location,
      bufferBeforeMin: item.bufferBeforeMin,
      bufferAfterMin: item.bufferAfterMin,
    });
  } else {
    await tx.insert(flexibleItemDetails).values({
      itemId: id,
      durationMin: item.durationMin,
      earliestStart: item.earliestStart,
      deadline: item.deadline,
      splitMinChunkMin: item.split?.minChunkMin ?? null,
      splitMaxChunkMin: item.split?.maxChunkMin ?? null,
      preferredWindows: item.preferredWindows,
      spread: item.spread,
    });
  }
  return id;
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
