import { bufferedSpan, type FixedItem, PRIORITIES, type Task } from "@/lib/items";
import { type Interval, type IntervalSet, intersectIntervals, subtractIntervals } from "@/lib/time/interval";

/** A task as one plan sees it: with the times its blocks may use, worked out once per plan. */
export interface PlanTask extends Task {
  /**
   * Where its blocks may go, in the order it gives up its preferences until it fits: outside every optional fixed item,
   * then also in the time of those less important than it. Each is inside its window and holds the ones before it.
   */
  allowed: IntervalSet[];
}

/** `task` with the times its blocks may use around `optional` fixed items. */
export function planTask(task: Task, optional: FixedItem[] = []): PlanTask {
  const window = [taskWindow(task)];
  const level = (item: { priority: Task["priority"] }) => PRIORITIES.indexOf(item.priority);
  const holding = optional.filter((item) => level(item) <= level(task));
  return {
    ...task,
    allowed: [
      subtractIntervals(window, optional.map(bufferedSpan)),
      ...(holding.length < optional.length ? [subtractIntervals(window, holding.map(bufferedSpan))] : []),
    ],
  };
}

/** The span `task`'s blocks must fall in: from its earliest start to its deadline. */
export function taskWindow(task: Task): Interval {
  return { start: task.earliestStart, end: task.deadline };
}

/** The parts of `free` that `task`'s blocks may use at all. Every placement decision about a task goes through this. */
export function openTo(task: PlanTask, free: IntervalSet): IntervalSet {
  return intersectIntervals(free, task.allowed.at(-1)!);
}
