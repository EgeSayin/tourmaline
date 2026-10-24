import { type BlockPlacement, type EditTarget, type OccurrenceEdit, toBlockPlacement } from "@/lib/calendar-blocks";
import { isTask, type Item, itemSpan } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { parseOccurrenceId } from "@/lib/recurrence";
import { OCCURRENCES_SHOWN } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import { loadQueue, type QueuedTask } from "@/server/planning/saved-plan";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { editTargets, occurrenceEdit } from "@/server/edit-targets";
import { type CategoryEntry, listCategories } from "@/server/categories/category-list";
import { loadCategories } from "@/server/db/categories-repository";
import { loadItem, loadItems } from "@/server/db/items-repository";
import { loadSettings } from "@/server/db/settings-repository";
import { loadDoneMinutes, loadItemPlacements, loadTaskPlacements } from "@/server/db/placements-repository";
import { upcomingOccurrences } from "@/server/recurrence";

/**
 * `queued`: planned, but its remaining time, or an occurrence's, doesn't fit before its deadline. `done`: marked done,
 * or for a series with a total, its done blocks reach it. `past`: its deadline or end has passed. Otherwise
 * `scheduled`.
 */
export type ItemStatus = "scheduled" | "queued" | "done" | "past";

/** One item you've added, as the item list shows it: a task, or a fixed item, which the list calls an event. */
export interface ItemEntry {
  id: string;
  title: string;
  kind: "task" | "event";
  recurring: boolean;
  /** A task's deadline or an event's start: for a series, its next occurrence's. */
  when: Date;
  /** For a series with a total: the minutes of its blocks done, out of the total. */
  progress: { doneMin: number; totalMin: number } | null;
  status: ItemStatus;
  target: EditTarget;
}

/**
 * Every item with its status, sorted by `when`; `queue` is the plan's (see `loadQueue`), and `doneMin` the minutes of
 * each item's blocks marked done.
 */
function listItems(
  items: Item[],
  queue: QueuedTask[],
  doneMin: ReadonlyMap<string, number>,
  targetFor: (id: string) => EditTarget | undefined,
  now: Date,
): ItemEntry[] {
  const queued = new Set(queue.map((task) => parseOccurrenceId(task.id).itemId));
  const entries = items.map((item): ItemEntry => {
    const target = targetFor(item.id)!;
    const span = itemSpan(target.item);
    const task = isTask(item);
    const progress =
      task && item.totalMin !== null ? { doneMin: doneMin.get(item.id) ?? 0, totalMin: item.totalMin } : null;
    const finished = task && (item.done || (progress !== null && progress.doneMin >= progress.totalMin));
    return {
      id: item.id,
      title: item.title,
      kind: task ? "task" : "event",
      recurring: item.recurrence !== null,
      when: task ? span.end : span.start,
      progress,
      status: finished ? "done" : queued.has(item.id) ? "queued" : span.end <= now ? "past" : "scheduled",
      target,
    };
  });
  return entries.sort((a, b) => a.when.getTime() - b.when.getTime());
}

export interface ItemList {
  timeZone: TimeZone;
  items: ItemEntry[];
  categories: CategoryEntry[];
}

/** Every item with its status (see `listItems`), and the categories to file them under. */
export async function loadItemList(tx: WorkspaceTx, now: Date): Promise<ItemList> {
  const [settings, items, categories, doneMin] = await Promise.all([
    loadSettings(tx),
    loadItems(tx),
    loadCategories(tx),
    loadDoneMinutes(tx),
  ]);
  const { timeZone } = settings;
  const queue = await loadQueue(tx, items, settings, now);
  return {
    timeZone,
    items: listItems(items, queue, doneMin, editTargets(items, now, timeZone), now),
    categories: listCategories(categories, items),
  };
}

export interface TaskBlock {
  start: Date;
  end: Date;
  placement: BlockPlacement;
}

export async function loadTaskBlocks(tx: WorkspaceTx, taskId: string, now: Date): Promise<TaskBlock[]> {
  return (await loadTaskPlacements(tx, taskId)).map((placement) => toTaskBlock(placement, now));
}

function toTaskBlock(placement: Placement, now: Date): TaskBlock {
  return { start: placement.start, end: placement.end, placement: toBlockPlacement(placement, now) };
}

export interface OccurrenceEntry {
  date: string;
  start: Date;
  /** A fixed occurrence's end, or a task occurrence's deadline. */
  end: Date;
  /** Whether it has its own timing. */
  changed: boolean;
  blocks: TaskBlock[];
}

export interface ItemSchedule {
  blocks: TaskBlock[];
  occurrences: OccurrenceEntry[];
}

/**
 * The schedule of item `id` at `now`: a one-off task's blocks, or the first `OCCURRENCES_SHOWN` occurrences of a
 * series that end after `now`, skipped ones left out. Empty for a one-off fixed item or a missing one.
 */
export async function loadSchedule(tx: WorkspaceTx, id: string, now: Date, timeZone: TimeZone): Promise<ItemSchedule> {
  const item = await loadItem(tx, id);
  if (!item?.recurrence) {
    return { blocks: item && isTask(item) ? await loadTaskBlocks(tx, id, now) : [], occurrences: [] };
  }
  const placements = isTask(item) ? await loadItemPlacements(tx, id) : [];
  const occurrences = upcomingOccurrences(item, now, OCCURRENCES_SHOWN, timeZone).map((occurrence) => ({
    date: parseOccurrenceId(occurrence.id).date!,
    ...itemSpan(occurrence),
    changed: parseOccurrenceId(occurrence.id).date! in item.changes,
    blocks: placements.filter((placement) => placement.taskId === occurrence.id).map((p) => toTaskBlock(p, now)),
  }));
  return { blocks: [], occurrences };
}

/** Series `id`'s occurrence on local date `date`, or `null` if there is none, or it's skipped. */
export async function loadOccurrenceEdit(
  tx: WorkspaceTx,
  id: string,
  date: string,
  timeZone: TimeZone,
): Promise<OccurrenceEdit | null> {
  const item = await loadItem(tx, id);
  return item ? occurrenceEdit(item, date, timeZone) : null;
}
