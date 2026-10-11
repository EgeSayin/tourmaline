import { minutesBetween } from "@/lib/time/duration";
import { type Task, PRIORITIES } from "@/lib/items";
import { clipIntervals, type Interval } from "@/lib/time/interval";

/**
 * Share of the free time between the task's `earliestStart` and `deadline` that the task needs.
 * `Infinity` when there is no free time in that window.
 */
export function pressure(task: Task, free: readonly Interval[]): number {
  const availableMin = clipIntervals(free, { start: task.earliestStart, end: task.deadline }).reduce(
    (sum, slot) => sum + minutesBetween(slot.start, slot.end),
    0,
  );
  return availableMin === 0 ? Infinity : task.durationMin / availableMin;
}

/** Returns the tasks sorted by priority, then pressure (highest first), then deadline, then id. */
export function orderByUrgency(tasks: Task[], free: readonly Interval[]): Task[] {
  const pressures = new Map(tasks.map((task) => [task.id, pressure(task, free)]));
  const compare = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

  return [...tasks].sort(
    (a, b) =>
      compare(PRIORITIES.indexOf(a.priority), PRIORITIES.indexOf(b.priority)) ||
      compare(pressures.get(b.id)!, pressures.get(a.id)!) ||
      compare(a.deadline.getTime(), b.deadline.getTime()) ||
      a.id.localeCompare(b.id),
  );
}
