import type { Task } from "@/lib/items";
import { clipIntervals, type Interval, type IntervalSet } from "@/lib/time/interval";

/** The span `task`'s blocks must fall in: from its earliest start to its deadline. */
export function taskWindow(task: Task): Interval {
  return { start: task.earliestStart, end: task.deadline };
}

/** The parts of `free` that `task`'s blocks may use. Every placement decision about a task goes through this. */
export function openTo(task: Task, free: IntervalSet): IntervalSet {
  return clipIntervals(free, taskWindow(task));
}
