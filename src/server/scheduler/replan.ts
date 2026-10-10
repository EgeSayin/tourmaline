import "server-only";
import { minutesBetween } from "@/lib/time/duration";
import type { FixedItem, Task } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import type { TimeZone } from "@/lib/time/time-zone";
import { freeTimeMap } from "./free-time";
import { type Interval, type IntervalSet, mergeIntervals, subtractIntervals } from "@/lib/time/interval";
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
  /** Kept and newly placed, sorted by start. */
  placements: Placement[];
  /** Tasks whose remaining time didn't fit; `durationMin` is the remaining time. */
  unplaced: Task[];
}

/**
 * Keeps placements that have started or are pinned. Other existing placements are kept too while they remain
 * valid (inside their task's window, in free time, not overlapping), and each task's remaining time is placed
 * in the free time from `now` on. Only if some task then doesn't fit are the unpinned future placements
 * dropped and everything re-placed.
 */
export function replan({ horizon, fixedItems, tasks, existing, settings }: ReplanInput): ReplanResult {
  const now = horizon.start;
  const kept = existing.filter((placement) => placement.pinned || placement.start < now);
  const movable = existing.filter((placement) => !placement.pinned && placement.start >= now);

  const freeFromNow = now < horizon.end ? freeTimeMap(horizon, fixedItems, settings) : mergeIntervals([]);
  const free = subtractIntervals(freeFromNow, kept);
  const startingNow = tasks.map((task) => ({
    ...task,
    earliestStart: task.earliestStart > now ? task.earliestStart : now,
  }));

  const stable = fillAround(startingNow, kept, movable, free, settings.timeZone);
  return stable.unplaced.length === 0 ? stable : fillAround(startingNow, kept, [], free, settings.timeZone);
}

/** Keeps `kept`, keeps each of `preferred` that still fits, then places every task's remaining time. */
function fillAround(
  tasks: Task[],
  kept: Placement[],
  preferred: Placement[],
  free: IntervalSet,
  timeZone: TimeZone,
): ReplanResult {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const placedMinutes = new Map<string, number>();
  const addMinutes = (placement: Placement) =>
    placedMinutes.set(
      placement.taskId,
      (placedMinutes.get(placement.taskId) ?? 0) + minutesBetween(placement.start, placement.end),
    );
  kept.forEach(addMinutes);

  let open = free;
  const preserved: Placement[] = [];
  for (const placement of [...preferred].sort((a, b) => a.start.getTime() - b.start.getTime())) {
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
    addMinutes(placement);
    open = subtractIntervals(open, [placement]);
  }

  const remainingTasks = tasks
    .map((task) => ({ ...task, durationMin: task.durationMin - (placedMinutes.get(task.id) ?? 0) }))
    .filter((task) => task.durationMin > 0);
  const { placements: added, unplaced } = placeTasks(remainingTasks, open, timeZone);

  const placements = [...kept, ...preserved, ...added].sort((a, b) => a.start.getTime() - b.start.getTime());
  return { placements, unplaced };
}
