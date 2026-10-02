import "server-only";
import { minutesBetween } from "@/lib/duration";
import { type FlexibleItem, PRIORITIES } from "@/lib/items";
import type { Interval } from "./intervals";

/**
 * Share of the free time between the task's `earliestStart` and `deadline` that the task needs.
 * `Infinity` when there is no free time in that window.
 */
export function pressure(task: FlexibleItem, free: Interval[]): number {
  let availableMin = 0;
  for (const slot of free) {
    const start = slot.start > task.earliestStart ? slot.start : task.earliestStart;
    const end = slot.end < task.deadline ? slot.end : task.deadline;
    if (start < end) availableMin += minutesBetween(start, end);
  }
  return availableMin === 0 ? Infinity : task.durationMin / availableMin;
}

/** Returns the tasks sorted by priority, then pressure (highest first), then deadline, then id. */
export function orderByUrgency(tasks: FlexibleItem[], free: Interval[]): FlexibleItem[] {
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
