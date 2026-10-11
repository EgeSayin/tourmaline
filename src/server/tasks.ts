import "server-only";
import type { EditTarget } from "@/lib/calendar-blocks";
import { isTask, type Item, itemSpan, type Task } from "@/lib/items";
import { parseOccurrenceId } from "@/lib/recurrence";

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
