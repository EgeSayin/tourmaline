import { isFixed, isTask, type Item, itemSpan, type NewItem } from "@/lib/items";
import type { PlacementRef, PlacementStatus } from "@/lib/placements";
import { occurrenceId, parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import {
  deleteItem,
  deleteOverrides,
  insertItem,
  loadItem,
  moveOverrides,
  setItemDone,
  setOccurrenceDone,
  skipOccurrence as saveSkip,
  updateItem,
} from "@/server/db/items-repository";
import {
  checkOffStarted,
  deletePlacements,
  dropPlanned,
  dropPlannedOccurrences,
  loadPlacement,
  moveOccurrencePlacements,
  updatePlacement,
} from "@/server/db/placements-repository";
import { firstOccurrence } from "@/server/recurrence";
import { localDate } from "@/server/time/temporal";

export function createItem(tx: WorkspaceTx, item: NewItem): Promise<string> {
  return insertItem(tx, item);
}

/**
 * Saves `item` over the stored item `id`, from `item`'s first local date on. A series that already occurred before
 * that date keeps those occurrences: it ends the day before, and `item` is saved as a new item that takes over the
 * series' overrides and the blocks of its occurrences from that date if it recurs. Anything else is updated in place.
 * Returns the id that now holds `item`, or `undefined` if no item has `id`.
 */
export async function editItem(
  tx: WorkspaceTx,
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
  if (item.recurrence) {
    await moveOverrides(tx, id, newId, from.toString());
    if (isTask(item)) await moveOccurrencePlacements(tx, id, newId, from.toString());
  }
  return newId;
}

/**
 * Removes the stored item `id` from today on: a series that already occurred before today ends yesterday and keeps
 * its past, dropping the planned blocks of the removed occurrences; anything else is deleted. Returns `false` if no
 * item has `id`.
 */
export async function removeItem(tx: WorkspaceTx, id: string, now: Date, timeZone: TimeZone): Promise<boolean> {
  const existing = await loadItem(tx, id);
  if (!existing) return false;

  const today = localDate(now, timeZone);
  if (await endSeriesBefore(tx, existing, today, now, timeZone)) {
    await dropPlannedOccurrences(tx, id, today.toString(), now);
  } else {
    await deleteItem(tx, id);
  }
  return true;
}

/**
 * Skips the occurrence of series `itemId` on local date `date`, dropping its planned blocks from `now` on. Returns
 * `false` if no series has `itemId`.
 */
export async function skipOccurrence(tx: WorkspaceTx, itemId: string, date: string, now: Date): Promise<boolean> {
  const item = await loadItem(tx, itemId);
  if (!item?.recurrence) return false;

  await saveSkip(tx, itemId, date);
  await dropPlanned(tx, occurrenceId(itemId, date), now);
  return true;
}

/**
 * Marks the one-off task `itemId`, or with `date` its series' occurrence on that local date, done or not done.
 * Marking it done also checks off its blocks started before `now` and drops the later ones. Returns `false` if there
 * is no such task.
 */
export async function setTaskDone(
  tx: WorkspaceTx,
  itemId: string,
  date: string | null,
  done: boolean,
  now: Date,
): Promise<boolean> {
  const item = await loadItem(tx, itemId);
  if (!item || !isTask(item) || (date !== null) !== (item.recurrence !== null)) return false;

  if (date) await setOccurrenceDone(tx, itemId, date, done);
  else await setItemDone(tx, itemId, done);
  if (done) {
    const taskId = date ? occurrenceId(itemId, date) : itemId;
    await checkOffStarted(tx, taskId, now);
    await dropPlanned(tx, taskId, now);
  }
  return true;
}

/**
 * Checks off, marks missed or plans again the placement `ref` points to. Only one that has started by `now` can be
 * missed. Returns `false` if there is no such placement.
 */
export async function setPlacementStatus(
  tx: WorkspaceTx,
  ref: PlacementRef,
  status: PlacementStatus,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement) return false;
  if (status === "missed" && placement.start > now) throw new Error("Only a started placement can be missed");

  await updatePlacement(tx, ref, { status });
  return true;
}

/**
 * Pins or unpins the placement `ref` points to. Only a planned one that hasn't ended by `now` can be pinned.
 * Returns `false` if there is no such placement.
 */
export async function setPlacementPinned(
  tx: WorkspaceTx,
  ref: PlacementRef,
  pinned: boolean,
  now: Date,
): Promise<boolean> {
  const placement = await loadPlacement(tx, ref);
  if (!placement) return false;
  if (pinned && (placement.status !== "planned" || placement.end <= now)) {
    throw new Error("Only a planned placement that hasn't ended can be pinned");
  }

  await updatePlacement(tx, ref, { pinned });
  return true;
}

/**
 * Replaces the stored item `id` with `item`. A task keeps all but its pending placements, so time already spent
 * on it still counts, and the rest are placed again; a fixed item has none. Overrides stay only while it recurs.
 */
async function saveInPlace(tx: WorkspaceTx, id: string, item: NewItem, now: Date): Promise<void> {
  await deletePlacements(tx, id, isFixed(item) ? undefined : now);
  if (!item.recurrence) await deleteOverrides(tx, id);
  await updateItem(tx, id, item);
}

/**
 * If `item` is a series that occurred before `date`, ends it the day before (unless it already ends earlier) and
 * returns `true`.
 */
async function endSeriesBefore(
  tx: WorkspaceTx,
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
