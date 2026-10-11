import { type BlockPlacement, type EditTarget, toBlockPlacement } from "@/lib/calendar-blocks";
import { isTask, type Item, itemSpan, type Task } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import { OCCURRENCES_SHOWN } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import type { WorkspaceTx } from "@/server/db/workspace-transaction";
import { loadItem } from "@/server/db/items-repository";
import { loadTaskPlacements } from "@/server/db/placements-repository";
import { upcomingOccurrences } from "@/server/recurrence";

/**
 * `queued`: planned, but its remaining time, or an occurrence's, doesn't fit before its deadline. `done`: marked done.
 * `past`: its deadline or end has passed. Otherwise `scheduled`.
 */
export type TaskStatus = "scheduled" | "queued" | "done" | "past";

/** One item you've added: a task, or a fixed item, which is a task with a single block. */
export interface TaskEntry {
  id: string;
  title: string;
  kind: "task" | "event";
  recurring: boolean;
  /** A task's deadline or an event's start: for a series, its next occurrence's. */
  when: Date;
  status: TaskStatus;
  target: EditTarget;
}

/** Every item with its status, sorted by `when`; `unplaced` is the plan's (see `syncPlan`). */
export function listTasks(
  items: Item[],
  unplaced: Task[],
  targetFor: (id: string) => EditTarget | undefined,
  now: Date,
): TaskEntry[] {
  const queued = new Set(
    unplaced.filter((task) => task.deadline > now).map((task) => parseOccurrenceId(task.id).itemId),
  );
  const entries = items.map((item): TaskEntry => {
    const target = targetFor(item.id)!;
    const span = itemSpan(target.item);
    const task = isTask(item);
    return {
      id: item.id,
      title: item.title,
      kind: task ? "task" : "event",
      recurring: item.recurrence !== null,
      when: task ? span.end : span.start,
      status: task && item.done ? "done" : queued.has(item.id) ? "queued" : span.end <= now ? "past" : "scheduled",
      target,
    };
  });
  return entries.sort((a, b) => a.when.getTime() - b.when.getTime());
}

export interface TaskBlock {
  start: Date;
  end: Date;
  placement: BlockPlacement;
}

export async function loadTaskBlocks(tx: WorkspaceTx, taskId: string, now: Date): Promise<TaskBlock[]> {
  return (await loadTaskPlacements(tx, taskId)).map((placement) => ({
    start: placement.start,
    end: placement.end,
    placement: toBlockPlacement(placement, now),
  }));
}

export interface OccurrenceEntry {
  date: string;
  start: Date;
  /** A fixed occurrence's end, or a task occurrence's deadline. */
  end: Date;
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
  const occurrences: OccurrenceEntry[] = [];
  for (const occurrence of upcomingOccurrences(item, now, OCCURRENCES_SHOWN, timeZone)) {
    const { start, end } = itemSpan(occurrence);
    const blocks = isTask(occurrence) ? await loadTaskBlocks(tx, occurrence.id, now) : [];
    occurrences.push({ date: parseOccurrenceId(occurrence.id).date!, start, end, blocks });
  }
  return { blocks: [], occurrences };
}
