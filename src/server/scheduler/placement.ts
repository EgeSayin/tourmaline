import "server-only";
import type { Task } from "@/lib/items";
import { type Placement, SLOT_MIN } from "@/lib/placements";
import { addMinutes, minutesBetween } from "@/lib/time/duration";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import { orderByUrgency } from "./urgency";

const SLOT_MS = SLOT_MIN * 60_000;

export interface PlacementResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: Task[];
}

/** Places each task as one block at its earliest fit in `free`, most urgent first. */
export function placeTasks(tasks: Task[], free: IntervalSet): PlacementResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: Task[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const slot = findEarliestSlot(remaining, task.durationMin, { start: task.earliestStart, end: task.deadline });
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

function ceilToSlot(date: Date): Date {
  return new Date(Math.ceil(date.getTime() / SLOT_MS) * SLOT_MS);
}
