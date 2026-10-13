import { type Task, PRIORITIES } from "@/lib/items";
import type { IntervalSet } from "@/lib/time/interval";
import { slotMinutes } from "./search";
import { openTo } from "./task-time";

/** Ranks the tasks still to place against the free time left, first to place first. */
export type TaskOrder = (tasks: Task[], free: IntervalSet) => Task[];

type Comparator = (a: Task, b: Task) => number;

/**
 * Share of the usable free time open to the task (see `openTo`) that it needs: stretches too
 * short on the grid for one of its blocks (or its smallest chunk) don't count. `Infinity` when none is usable.
 */
export function pressure(task: Task, free: IntervalSet): number {
  const blockMin = Math.min(task.split?.minChunkMin ?? task.durationMin, task.durationMin);
  const usableMin = openTo(task, free)
    .map(slotMinutes)
    .filter((minutes) => minutes >= blockMin)
    .reduce((sum, minutes) => sum + minutes, 0);
  return usableMin === 0 ? Infinity : task.durationMin / usableMin;
}

const compare = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);
const byPriority: Comparator = (a, b) => compare(PRIORITIES.indexOf(a.priority), PRIORITIES.indexOf(b.priority));
const byDeadline: Comparator = (a, b) => compare(a.deadline.getTime(), b.deadline.getTime());
const byId: Comparator = (a, b) => a.id.localeCompare(b.id);

function byPressure(tasks: Task[], free: IntervalSet): Comparator {
  const pressures = new Map(tasks.map((task) => [task.id, pressure(task, free)]));
  return (a, b) => compare(pressures.get(b.id)!, pressures.get(a.id)!);
}

function sortBy(tasks: Task[], ...comparators: Comparator[]): Task[] {
  return [...tasks].sort((a, b) => comparators.reduce((order, comparator) => order || comparator(a, b), 0));
}

/** By priority, then pressure (highest first), then deadline, then id. */
export const byUrgency: TaskOrder = (tasks, free) =>
  sortBy(tasks, byPriority, byPressure(tasks, free), byDeadline, byId);

/** By priority, then deadline (earliest first), then id. */
export const byEarliestDeadline: TaskOrder = (tasks) => sortBy(tasks, byPriority, byDeadline, byId);

/** Like `byUrgency`, but within each priority the tasks `first` holds go before the rest. */
export const withFirst =
  (first: ReadonlySet<string>): TaskOrder =>
  (tasks, free) =>
    sortBy(
      tasks,
      byPriority,
      (a, b) => Number(first.has(b.id)) - Number(first.has(a.id)),
      byPressure(tasks, free),
      byDeadline,
      byId,
    );
