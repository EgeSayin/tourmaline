import "server-only";
import { isFixed, type Item, itemSpan, type NewItem } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Transaction } from "@/server/db/connection";
import {
  deleteItem,
  deleteOverrides,
  insertItem,
  loadItem,
  moveOverrides,
  skipOccurrence as saveSkip,
  updateItem,
} from "@/server/db/items-repository";
import { deletePlacements } from "@/server/db/placements-repository";
import { firstOccurrence } from "@/server/recurrence";
import { localDate } from "@/server/time/temporal";

export function createItem(tx: Transaction, item: NewItem): Promise<string> {
  return insertItem(tx, item);
}

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

  const from = localDate(itemSpan(item).start, timeZone);
  if (!(await endSeriesBefore(tx, existing, from, now, timeZone))) {
    await saveInPlace(tx, id, item, now);
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

  if (!(await endSeriesBefore(tx, existing, localDate(now, timeZone), now, timeZone))) await deleteItem(tx, id);
  return true;
}

/** Skips the occurrence of series `itemId` on local date `date`. Returns `false` if no series has `itemId`. */
export async function skipOccurrence(tx: Transaction, itemId: string, date: string): Promise<boolean> {
  const item = await loadItem(tx, itemId);
  if (!item?.recurrence) return false;

  await saveSkip(tx, itemId, date);
  return true;
}

/**
 * Replaces the stored item `id` with `item`. A task keeps all but its pending placements, so time already spent
 * on it still counts, and the rest are placed again; a fixed item has none. Overrides stay only while it recurs.
 */
async function saveInPlace(tx: Transaction, id: string, item: NewItem, now: Date): Promise<void> {
  await deletePlacements(tx, id, isFixed(item) ? undefined : now);
  if (!item.recurrence) await deleteOverrides(tx, id);
  await updateItem(tx, id, item);
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
  await saveInPlace(
    tx,
    item.id,
    { ...item, recurrence: { ...item.recurrence, until: until && until < dayBefore ? until : dayBefore } },
    now,
  );
  return true;
}
