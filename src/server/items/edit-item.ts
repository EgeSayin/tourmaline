import "server-only";
import type { Item, NewItem } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time-zone";
import type { Transaction } from "@/server/db/connection";
import { deleteItem, insertItem, loadItem, moveOverrides, updateItem } from "@/server/db/items-repository";
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
  if (!(await endSeriesBefore(tx, existing, from, now, timeZone))) {
    await updateItem(tx, id, item, now);
    return id;
  }

  const newId = await insertItem(tx, item);
  if (item.recurrence) await moveOverrides(tx, id, newId, from.toString());
  return newId;
}

/**
 * Removes the stored item `id` from today on: a series that already occurred before today ends yesterday and keeps
 * its past; anything else is deleted. Returns `false` if no item has `id`.
 */
export async function removeItem(tx: Transaction, id: string, now: Date, timeZone: TimeZone): Promise<boolean> {
  const existing = await loadItem(tx, id);
  if (!existing) return false;

  const today = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone).toPlainDate();
  if (!(await endSeriesBefore(tx, existing, today, now, timeZone))) await deleteItem(tx, id);
  return true;
}

/**
 * If `item` is a series that occurred before `date`, ends it the day before (unless it already ends earlier) and
 * returns `true`.
 */
async function endSeriesBefore(
  tx: Transaction,
  item: Item,
  date: Temporal.PlainDate,
  now: Date,
  timeZone: TimeZone,
): Promise<boolean> {
  const first = firstOccurrence(item, timeZone);
  const firstDate = first && parseOccurrenceId(first.id).date;
  if (!item.recurrence || !firstDate || firstDate >= date.toString()) return false;

  const dayBefore = date.subtract({ days: 1 }).toString();
  const { until } = item.recurrence;
  await updateItem(
    tx,
    item.id,
    { ...item, recurrence: { ...item.recurrence, until: until && until < dayBefore ? until : dayBefore } },
    now,
  );
  return true;
}
