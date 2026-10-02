import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { db } from "./client";
import { fixedItemDetails, flexibleItemDetails, items } from "./schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewItem = Omit<FixedItem, "id"> | Omit<FlexibleItem, "id">;

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
