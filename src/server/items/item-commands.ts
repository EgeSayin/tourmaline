import { isFixed, isTask, type Item, itemSpan, type NewItem } from "@/lib/items";
import {
  type OccurrenceChange,
  type OccurrenceChanges,
  occurrenceId,
  type Occurrences,
  parseOccurrenceId,
} from "@/lib/recurrence";
import type { PlacementRef } from "@/lib/placements";
import { addMinutes } from "@/lib/time/duration";
import type { TimeZone } from "@/lib/time/time-zone";
import { attempt, type WorkspaceTx } from "@/server/db/workspace-transaction";
import {
  deleteItem,
  insertItem,
  loadItem,
  loadItems,
  saveOccurrence,
  setItemDone,
  updateItem,
} from "@/server/db/items-repository";
import {
  checkOffStarted,
  deletePendingPlacements,
  dropPlanned,
  dropPlannedOccurrences,
  loadPlacement,
  moveOccurrencePlacements,
  unpinPlannedBefore,
} from "@/server/db/placements-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { previewPlan } from "@/server/planning/sync-plan";
import { firstOccurrence, occurrenceOn, occursOn } from "@/server/recurrence";
import { localDate } from "@/server/time/temporal";

export function createItem(tx: WorkspaceTx, item: NewItem): Promise<string> {
  return insertItem(tx, item);
}

/**
 * Saves `item` over the stored item `id`, from `item`'s first local date on. A series that already occurred before
 * that date keeps those occurrences: it ends the day before, and `item` is saved as a new item that takes over the
 * series' occurrence states, the changed occurrences that still occur under its rule, and the blocks of its
 * occurrences from that date if it recurs. Anything else is updated in place, or replaced by a new item if its kind
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
  const kept = (date: string) => existing.timing === item.timing && occursOn(item, date, timeZone);
  if (!occurredBefore(existing, from, timeZone)) {
    const history = item.recurrence
      ? { occurrences: existing.occurrences, changes: changesWhere(existing.changes, kept) }
      : NO_HISTORY;
    return saveInPlace(tx, existing, item, history, now);
  }

  const history = item.recurrence
    ? {
        occurrences: occurrencesFrom(existing.occurrences, from),
        changes: changesWhere(existing.changes, (date) => date >= from && kept(date)),
      }
    : NO_HISTORY;
  const newId = await insertItem(tx, item, history.occurrences, history.changes);
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

  await saveOccurrence(tx, item, date, { state: "skipped" });
  await dropPlanned(tx, occurrenceId(itemId, date), now);
  return true;
}

/**
 * Gives the occurrence of series `itemId` on local date `date` its own timing, or with `null` its series' again.
 * Returns `false` if the series has no such occurrence, or `change` doesn't fit its kind: a task occurrence's has a
 * duration, a fixed one's doesn't.
 */
export async function changeOccurrence(
  tx: WorkspaceTx,
  itemId: string,
  date: string,
  change: OccurrenceChange | null,
  now: Date,
  timeZone: TimeZone,
): Promise<boolean> {
  const item = await loadItem(tx, itemId);
  if (!item?.recurrence || !occursOn(item, date, timeZone) || item.occurrences[date] === "skipped") return false;
  if (change && (change.durationMin === null) !== isFixed(item)) return false;

  await saveOccurrence(tx, item, date, { change });
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
    await saveOccurrence(tx, item, date, { state: done ? "done" : null });
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

/** How `bumpTask` turned out: `past-due` and `no-room` changed nothing. */
export type BumpOutcome = "bumped" | "past-due" | "no-room";

/**
 * Bumps the task of the planned block `ref` points to, which mustn't have started by `now`, by `byMin`: its earliest
 * start, or its occurrence's own, moves to the block's start plus `byMin`, and its pinned blocks before then are
 * unpinned, so the next plan drops its blocks before then and places their time again from there on, keeping its
 * later blocks. Returns `past-due` if that would be at or past its deadline, `no-room` if more of the task would then
 * be left unplaced than now, and `false` if there is no such block.
 */
export async function bumpTask(
  tx: WorkspaceTx,
  ref: PlacementRef,
  byMin: number,
  now: Date,
): Promise<BumpOutcome | false> {
  const placement = await loadPlacement(tx, ref);
  if (!placement || placement.status !== "planned" || placement.start < now) return false;
  const settings = await loadSettings(tx);
  const { itemId, date } = parseOccurrenceId(ref.taskId);
  const item = await loadItem(tx, itemId);
  if (!item || !isTask(item)) return false;
  const task = date ? occurrenceOn(item, date, settings.timeZone)?.own : item.recurrence ? undefined : item;
  if (!task) return false;

  const notBefore = addMinutes(placement.start, byMin);
  if (notBefore >= task.deadline) return "past-due";

  const unplacedMin = async () => {
    const { unplaced } = await previewPlan(tx, await loadItems(tx), settings, now);
    return unplaced.find((candidate) => candidate.id === ref.taskId)?.durationMin ?? 0;
  };
  const before = await unplacedMin();
  return attempt(
    tx,
    async (tx) => {
      if (date) {
        const change = { start: notBefore, end: task.deadline, durationMin: task.durationMin };
        await saveOccurrence(tx, item, date, { change });
      } else {
        await updateItem(tx, item.id, { ...item, earliestStart: notBefore }, item.occurrences, item.changes);
      }
      await unpinPlannedBefore(tx, ref.taskId, notBefore);
      return (await unplacedMin()) > before ? "no-room" : "bumped";
    },
    (outcome) => outcome === "bumped",
  );
}

/** What a series keeps of its occurrences: their states and changes. */
interface History {
  occurrences: Occurrences;
  changes: OccurrenceChanges;
}

const NO_HISTORY: History = { occurrences: {}, changes: {} };

/**
 * Replaces `existing` with `item` and `history`, returning the id that now holds it: a new one if the kind
 * changes, which drops a task's placements. A task kept as one keeps all but its pending placements, so time already
 * spent on it still counts, and the rest are placed again.
 */
async function saveInPlace(
  tx: WorkspaceTx,
  existing: Item,
  item: NewItem,
  { occurrences, changes }: History,
  now: Date,
): Promise<string> {
  if (existing.timing !== item.timing) {
    await deleteItem(tx, existing);
    return insertItem(tx, item, occurrences, changes);
  }
  if (isTask(item)) await deletePendingPlacements(tx, existing.id, now);
  await updateItem(tx, existing.id, item, occurrences, changes);
  return existing.id;
}

/** Whether `item` is a series that occurred before local date `date`. */
function occurredBefore(item: Item, date: string, timeZone: TimeZone): boolean {
  const first = item.recurrence && firstOccurrence(item, timeZone);
  return !!first && parseOccurrenceId(first.id).date! < date;
}

/**
 * Ends series `item` the day before local date `date` (unless it already ends earlier), keeping the states and
 * changes of the occurrences before it. The blocks of those from it on that aren't pending move to series `successorId`, or the
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
  const history = {
    occurrences: occurrencesBefore(item.occurrences, date),
    changes: changesWhere(item.changes, (day) => day < date),
  };
  await saveInPlace(tx, item, ended, history, now);
  if (successorId) await moveOccurrencePlacements(tx, item.id, successorId, date);
  else await dropPlannedOccurrences(tx, item.id, date, now);
}

const occurrencesFrom = (occurrences: Occurrences, date: string): Occurrences =>
  Object.fromEntries(Object.entries(occurrences).filter(([day]) => day >= date));

const occurrencesBefore = (occurrences: Occurrences, date: string): Occurrences =>
  Object.fromEntries(Object.entries(occurrences).filter(([day]) => day < date));

const changesWhere = (changes: OccurrenceChanges, keep: (date: string) => boolean): OccurrenceChanges =>
  Object.fromEntries(Object.entries(changes).filter(([date]) => keep(date)));
