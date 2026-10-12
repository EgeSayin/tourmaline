import { isTask, type Item, itemSpan, type NewItem } from "@/lib/items";
import type { PlacementRef, PlacementStatus } from "@/lib/placements";
import { occurrenceId, type Occurrences, parseOccurrenceId } from "@/lib/recurrence";
import type { TimeZone } from "@/lib/time/time-zone";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import {
  deleteItem,
  insertItem,
  loadItem,
  setItemDone,
  setOccurrences,
  updateItem,
} from "@/server/db/items-repository";
import {
  checkOffStarted,
  deletePendingPlacements,
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
 * series' occurrence states and the blocks of its occurrences from that date if it recurs. Anything else is updated
 * in place, or replaced by a new item if its kind changes.
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

  const from = localDate(itemSpan(item).start, timeZone).toString();
  if (!occurredBefore(existing, from, timeZone)) {
    return saveInPlace(tx, existing, item, item.recurrence ? existing.occurrences : {}, now);
  }

  const newId = await insertItem(tx, item, item.recurrence ? occurrencesFrom(existing.occurrences, from) : {});
  await endSeriesBefore(tx, existing, from, now, item.recurrence && isTask(item) ? newId : undefined);
  return newId;
}

/**
 * Removes the stored item `id` from today on: a series that already occurred before today ends yesterday and keeps
 * its past; anything else is deleted. Returns `false` if no item has `id`.
 */
export async function removeItem(tx: WorkspaceTx, id: string, now: Date, timeZone: TimeZone): Promise<boolean> {
  const existing = await loadItem(tx, id);
  if (!existing) return false;

  const today = localDate(now, timeZone).toString();
  if (occurredBefore(existing, today, timeZone)) await endSeriesBefore(tx, existing, today, now);
  else await deleteItem(tx, existing);
  return true;
}

/**
 * Skips the occurrence of series `itemId` on local date `date`, dropping its planned blocks from `now` on. Returns
 * `false` if no series has `itemId`.
 */
export async function skipOccurrence(tx: WorkspaceTx, itemId: string, date: string, now: Date): Promise<boolean> {
  const item = await loadItem(tx, itemId);
  if (!item?.recurrence) return false;

  await setOccurrences(tx, item, { ...item.occurrences, [date]: "skipped" });
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

  if (date) {
    const { [date]: _, ...others } = item.occurrences;
    await setOccurrences(tx, item, done ? { ...others, [date]: "done" } : others);
  } else {
    await setItemDone(tx, itemId, done);
  }
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
 * Replaces `existing` with `item` and `occurrences`, returning the id that now holds it: a new one if the kind
 * changes, which drops a task's placements. A task kept as one keeps all but its pending placements, so time already
 * spent on it still counts, and the rest are placed again.
 */
async function saveInPlace(
  tx: WorkspaceTx,
  existing: Item,
  item: NewItem,
  occurrences: Occurrences,
  now: Date,
): Promise<string> {
  if (existing.timing !== item.timing) {
    await deleteItem(tx, existing);
    return insertItem(tx, item, occurrences);
  }
  if (isTask(item)) await deletePendingPlacements(tx, existing.id, now);
  await updateItem(tx, existing.id, item, occurrences);
  return existing.id;
}

/** Whether `item` is a series that occurred before local date `date`. */
function occurredBefore(item: Item, date: string, timeZone: TimeZone): boolean {
  const first = item.recurrence && firstOccurrence(item, timeZone);
  return !!first && parseOccurrenceId(first.id).date! < date;
}

/**
 * Ends series `item` the day before local date `date` (unless it already ends earlier), keeping the states of the
 * occurrences before it. The blocks of those from it on that aren't pending move to series `successorId`, or the
 * planned ones are dropped.
 */
async function endSeriesBefore(
  tx: WorkspaceTx,
  item: Item,
  date: string,
  now: Date,
  successorId?: string,
): Promise<void> {
  const dayBefore = Temporal.PlainDate.from(date).subtract({ days: 1 }).toString();
  const { until } = item.recurrence!;
  const ended = { ...item, recurrence: { ...item.recurrence!, until: until && until < dayBefore ? until : dayBefore } };
  await saveInPlace(tx, item, ended, occurrencesBefore(item.occurrences, date), now);
  if (successorId) await moveOccurrencePlacements(tx, item.id, successorId, date);
  else await dropPlannedOccurrences(tx, item.id, date, now);
}

const occurrencesFrom = (occurrences: Occurrences, date: string): Occurrences =>
  Object.fromEntries(Object.entries(occurrences).filter(([day]) => day >= date));

const occurrencesBefore = (occurrences: Occurrences, date: string): Occurrences =>
  Object.fromEntries(Object.entries(occurrences).filter(([day]) => day < date));
