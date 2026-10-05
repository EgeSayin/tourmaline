import "server-only";
import type { NewItem } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time-zone";
import type { Transaction } from "@/server/db/connection";
import { insertItem, loadItem, moveOverrides, updateItem } from "@/server/db/items-repository";
import { firstOccurrence } from "@/server/recurrence";

/**
 * Saves `item` over the stored item `id`, from `item`'s first local date on. A series that already occurred before
 * that date keeps those occurrences: it ends the day before, and `item` is saved as a new item that takes over the
 * series' overrides from that date if it recurs. Anything else is updated in place.
 * Returns the id that now holds `item`, or `undefined` if no item has `id`.
 */
export async function editItem(
  tx: Transaction,
  id: string,
  item: NewItem,
  now: Date,
  timeZone: TimeZone,
): Promise<string | undefined> {
  const existing = await loadItem(tx, id);
  if (!existing) return undefined;

  const start = item.timing === "fixed" ? item.start : item.earliestStart;
  const from = Temporal.Instant.fromEpochMilliseconds(start.getTime()).toZonedDateTimeISO(timeZone).toPlainDate();
  const first = firstOccurrence(existing, timeZone);
  const firstDate = first && parseOccurrenceId(first.id).date;
  if (!existing.recurrence || !firstDate || firstDate >= from.toString()) {
    await updateItem(tx, id, item, now);
    return id;
  }

  const dayBefore = from.subtract({ days: 1 }).toString();
  const { until } = existing.recurrence;
  const recurrence = { ...existing.recurrence, until: until && until < dayBefore ? until : dayBefore };
  await updateItem(tx, id, { ...existing, recurrence }, now);

  const newId = await insertItem(tx, item);
  if (item.recurrence) await moveOverrides(tx, id, newId, from.toString());
  return newId;
}
