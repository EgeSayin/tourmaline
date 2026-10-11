import "server-only";
import { minutesBetween } from "@/lib/time/duration";
import { type FixedItem, PRIORITIES, type Task } from "@/lib/items";
import { isPending, type Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "./free-time";
import { type Interval, type IntervalSet, later, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
import { placeTasks } from "./placement";

export interface ReplanInput {
  /** Starts now: earlier placements are done, and new ones go inside it. */
  horizon: Interval;
  fixedItems: FixedItem[];
  tasks: Task[];
  /** Placements saved from earlier runs. */
  existing: Placement[];
  settings: SchedulerSettings;
}

export interface ReplanResult {
  /** Kept and newly placed, sorted by start; missed ones are left out. */
  placements: Placement[];
  /** Tasks whose remaining time didn't fit, in the order given; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/**
 * Keeps placements that are done, pinned or in progress, and past planned ones still waiting to be reviewed, so
 * their task's time isn't moved before they are; missed ones are dropped, so their time is planned again. Pending
 * placements are kept too while they remain valid (inside their task's window, in free time, not overlapping), and
 * each task's remaining time is placed in the free time from `now` on.
 *
 * If some task then doesn't fit, less important tasks are bumped: the pending placements of each priority level are
 * dropped in turn, least important first, and everything not kept is placed again. The plan that leaves the fewest
 * tasks unplaced at the most important level wins, then at the next level, and so on; a tie goes to the plan that
 * keeps more. So tasks never leave a more important task unplaced through their pending placements.
 */
export function replan({ horizon, fixedItems, tasks, existing, settings }: ReplanInput): ReplanResult {
  const now = horizon.start;
  const kept = existing.filter((placement) => placement.status !== "missed" && !isPending(placement, now));
  const movable = existing.filter((placement) => isPending(placement, now));

  const freeFromNow = now < horizon.end ? freeTimeMap(horizon, fixedItems, settings) : mergeIntervals([]);
  const free = subtractIntervals(freeFromNow, kept);
  const startingNow = tasks.map((task) => ({
    ...task,
    earliestStart: later(task.earliestStart, now),
  }));

  const stable = fillAround(startingNow, kept, movable, free);
  if (stable.unplaced.length === 0) return stable;

  const priorityOf = new Map(tasks.map((task) => [task.id, PRIORITIES.indexOf(task.priority)]));
  const keepingAbove = (level: number) =>
    fillAround(
      startingNow,
      kept,
      movable.filter((placement) => (priorityOf.get(placement.taskId) ?? PRIORITIES.length) < level),
      free,
    );
  const bumped = PRIORITIES.map((_, level) => keepingAbove(level)).reverse();
  return bumped.reduce((best, plan) => (fewerUnplaced(plan, best) ? plan : best), stable);
}

/** Whether `a` leaves fewer tasks unplaced than `b` at the most important priority level where they differ. */
function fewerUnplaced(a: ReplanResult, b: ReplanResult): boolean {
  const counts = ({ unplaced }: ReplanResult) =>
    PRIORITIES.map((priority) => unplaced.filter((task) => task.priority === priority).length);
  const [countsA, countsB] = [counts(a), counts(b)];
  const level = countsA.findIndex((count, i) => count !== countsB[i]);
  return level !== -1 && countsA[level] < countsB[level];
}

/** Keeps `kept`, keeps each of `saved` that still fits, then places every task's remaining time. */
function fillAround(tasks: Task[], kept: Placement[], saved: Placement[], free: IntervalSet): ReplanResult {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const placedMinutes = new Map<string, number>();
  const countPlaced = (placement: Placement) =>
    placedMinutes.set(
      placement.taskId,
      (placedMinutes.get(placement.taskId) ?? 0) + minutesBetween(placement.start, placement.end),
    );
  kept.forEach(countPlaced);

  let open = free;
  const preserved: Placement[] = [];
  for (const placement of [...saved].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const task = tasksById.get(placement.taskId);
    if (!task) continue;
    const remaining = task.durationMin - (placedMinutes.get(task.id) ?? 0);
    const fits =
      minutesBetween(placement.start, placement.end) <= remaining &&
      placement.start >= task.earliestStart &&
      placement.end <= task.deadline &&
      subtractIntervals([placement], open).length === 0;
    if (!fits) continue;

    preserved.push(placement);
    countPlaced(placement);
    open = subtractIntervals(open, [placement]);
  }

  const remainingTasks = tasks
    .map((task) => ({ ...task, durationMin: task.durationMin - (placedMinutes.get(task.id) ?? 0) }))
    .filter((task) => task.durationMin > 0);
  const { placements: added, unplaced } = placeTasks(remainingTasks, open, [...kept, ...preserved]);

  const placements = [...kept, ...preserved, ...added].sort((a, b) => a.start.getTime() - b.start.getTime());
  const order = new Map(tasks.map((task, i) => [task.id, i]));
  return { placements, unplaced: unplaced.sort((a, b) => order.get(a.id)! - order.get(b.id)!) };
}
