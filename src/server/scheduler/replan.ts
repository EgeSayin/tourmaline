import "server-only";
import { minutesBetween } from "@/lib/duration";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "./free-time";
import { type Interval, subtractIntervals } from "./intervals";
import { placeTasks } from "./schedule";

export interface ReplanInput {
  range: Interval;
  now: Date;
  fixedItems: FixedItem[];
  flexibleItems: FlexibleItem[];
  /** Placements saved from earlier runs. */
  existing: Placement[];
  settings: SchedulerSettings;
}

export interface ReplanResult {
  /** Kept and newly placed, sorted by start. */
  placements: Placement[];
  /** Tasks whose remaining time didn't fit; `durationMin` is the remaining time. */
  unplaced: FlexibleItem[];
}

/**
 * Keeps placements that have started or are pinned. Other existing placements are kept too while they remain
 * valid (inside their task's window, in free time, not overlapping), and each task's remaining time is placed
 * in the free time from `now` on. Only if some task then doesn't fit are the unpinned future placements
 * dropped and everything re-placed.
 */
export function replan({ range, now, fixedItems, flexibleItems, existing, settings }: ReplanInput): ReplanResult {
  const kept = existing.filter((placement) => placement.pinned || placement.start < now);
  const movable = existing.filter((placement) => !placement.pinned && placement.start >= now);

  const planFrom = now > range.start ? now : range.start;
  const freeFromNow =
    planFrom < range.end ? freeTimeMap({ start: planFrom, end: range.end }, fixedItems, settings) : [];
  const free = subtractIntervals(freeFromNow, kept);
  const tasks = flexibleItems.map((task) => ({
    ...task,
    earliestStart: task.earliestStart > planFrom ? task.earliestStart : planFrom,
  }));

  const stable = fillAround(tasks, kept, movable, free);
  return stable.unplaced.length === 0 ? stable : fillAround(tasks, kept, [], free);
}

/** Keeps `kept`, keeps each of `preferred` that still fits, then places every task's remaining time. */
function fillAround(tasks: FlexibleItem[], kept: Placement[], preferred: Placement[], free: Interval[]): ReplanResult {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const placedMinutes = new Map<string, number>();
  const addMinutes = (placement: Placement) =>
    placedMinutes.set(
      placement.itemId,
      (placedMinutes.get(placement.itemId) ?? 0) + minutesBetween(placement.start, placement.end),
    );
  kept.forEach(addMinutes);

  let open = free;
  const preserved: Placement[] = [];
  for (const placement of [...preferred].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const task = tasksById.get(placement.itemId);
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
  const { placements: added, unplaced } = placeTasks(remainingTasks, open);

  const placements = [...kept, ...preserved, ...added].sort((a, b) => a.start.getTime() - b.start.getTime());
  return { placements, unplaced };
}
