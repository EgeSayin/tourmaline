import "server-only";
import { type BlockPlacement, type EditTarget, toBlockPlacement } from "@/lib/calendar-blocks";
import { isFixed, isTask, type Item, itemSpan, type Task } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";
import { OCCURRENCES_SHOWN } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import type { Database, Transaction } from "@/server/db/connection";
import { loadItem } from "@/server/db/items-repository";
import { loadTaskPlacements } from "@/server/db/placements-repository";
import { upcomingOccurrences } from "@/server/recurrence";

/**
 * `queued`: planned, but its remaining time, or an occurrence's, doesn't fit before its deadline. `done`: marked done.
 * `bumped`: a fixed item, or a series' next occurrence, that was bumped. `past`: its deadline or end has passed.
 * Otherwise `scheduled`.
 */
export type TaskStatus = "scheduled" | "queued" | "done" | "bumped" | "past";

/** One item you've added: a task, or a fixed item, which is a task with a single block. */
export interface TaskEntry {
  id: string;
  title: string;
  kind: "task" | "event";
  recurring: boolean;
  /** A task's deadline or an event's start: for a series, its next occurrence's. */
  when: Date;
  status: TaskStatus;
  /** Opens the item, a series at its next occurrence. */
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
    const status: TaskStatus =
      task && item.done
        ? "done"
        : queued.has(item.id)
          ? "queued"
          : span.end <= now
            ? "past"
            : isFixed(target.item) && target.item.bumped
              ? "bumped"
              : "scheduled";
    return {
      id: item.id,
      title: item.title,
      kind: task ? "task" : "event",
      recurring: item.recurrence !== null,
      when: task ? span.end : span.start,
      status,
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

/** The blocks of a task, or of an occurrence by its id, sorted by start, in their state at `now`. */
export async function loadTaskBlocks(
  executor: Database | Transaction,
  taskId: string,
  now: Date,
): Promise<TaskBlock[]> {
  return (await loadTaskPlacements(executor, taskId)).map((placement) => ({
    start: placement.start,
    end: placement.end,
    placement: toBlockPlacement(placement, now),
  }));
}

/** One upcoming occurrence of a series. */
export interface OccurrenceEntry {
  /** Local `YYYY-MM-DD`. */
  date: string;
  start: Date;
  /** A fixed occurrence's end, or a task occurrence's deadline. */
  end: Date;
  /** A task occurrence's blocks; none for a fixed one. */
  blocks: TaskBlock[];
}

/** What an item's editor lists: a one-off task's blocks, or a series' upcoming occurrences. */
export interface ItemSchedule {
  blocks: TaskBlock[];
  occurrences: OccurrenceEntry[];
}

/**
 * The schedule of item `id` at `now`: a one-off task's blocks, or the first `OCCURRENCES_SHOWN` occurrences of a
 * series that end after `now`, skipped ones left out. Empty for a one-off fixed item or a missing one.
 */
export async function loadSchedule(
  executor: Database | Transaction,
  id: string,
  now: Date,
  timeZone: TimeZone,
): Promise<ItemSchedule> {
  const item = await loadItem(executor, id);
  if (!item?.recurrence) {
    return { blocks: item && isTask(item) ? await loadTaskBlocks(executor, id, now) : [], occurrences: [] };
  }
  const occurrences: OccurrenceEntry[] = [];
  for (const occurrence of upcomingOccurrences(item, now, OCCURRENCES_SHOWN, timeZone)) {
    const { start, end } = itemSpan(occurrence);
    const blocks = isTask(occurrence) ? await loadTaskBlocks(executor, occurrence.id, now) : [];
    occurrences.push({ date: parseOccurrenceId(occurrence.id).date!, start, end, blocks });
  }
  return { blocks: [], occurrences };
}
