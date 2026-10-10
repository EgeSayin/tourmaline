import "server-only";
import type { Task } from "@/lib/items";
import { type Placement, SLOT_MIN } from "@/lib/placements";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import type { TimeZone } from "@/lib/time/time-zone";
import { dailyIntervals } from "./free-time";
import { orderByUrgency } from "./urgency";

const SLOT_MS = SLOT_MIN * 60_000;

export interface PlacementResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: Task[];
}

/**
 * Places each task as one block, most urgent first: at its earliest fit in `free` inside its preferred windows,
 * or else at its earliest fit anywhere in its window.
 */
export function placeTasks(tasks: Task[], free: IntervalSet, timeZone: TimeZone): PlacementResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const window = { start: task.earliestStart, end: task.deadline };
    const slot =
      findEarliestSlot(preferredTime(remaining, task, timeZone), task.durationMin, window) ??
      findEarliestSlot(remaining, task.durationMin, window);
    if (slot) {
      placements.push({ taskId: task.id, ...slot, source: "auto", pinned: false });
      remaining = subtractIntervals(remaining, [slot]);
    } else {
      unplaced.push(task);
    }
  }
  return { placements, unplaced };
}

/**
 * Returns the earliest `durationMin`-long block inside both a `free` interval and `window`, starting on the
 * `SLOT_MIN` grid, or `null` if none fits.
 */
export function findEarliestSlot(free: IntervalSet, durationMin: number, window: Interval): Interval | null {
  for (const slot of free) {
    const start = ceilToSlot(slot.start > window.start ? slot.start : window.start);
    const end = slot.end < window.end ? slot.end : window.end;
    if (minutesBetween(start, end) >= durationMin) {
      return { start, end: addMinutes(start, durationMin) };
    }
  }
  return null;
}

/** The part of `free` inside the task's preferred windows; all of `free` when it has none. */
function preferredTime(free: IntervalSet, task: Task, timeZone: TimeZone): IntervalSet {
  if (task.preferredWindows.length === 0) return free;
  const window = { start: task.earliestStart, end: task.deadline };
  const preferred = task.preferredWindows.flatMap((daily) => dailyIntervals(window, daily, timeZone));
  return subtractIntervals(free, subtractIntervals([window], preferred));
}

function ceilToSlot(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / SLOT_MS) * SLOT_MS);
}
