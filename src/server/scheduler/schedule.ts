import "server-only";
import type { FixedItem, FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import type { SchedulerSettings } from "@/lib/settings";
import { freeTimeMap } from "./free-time";
import type { Interval } from "./intervals";
import { placeSingleBlock } from "./place";
import { orderByUrgency } from "./urgency";

export interface ScheduleResult {
  /** In placement order, most urgent first. */
  placements: Placement[];
  unplaced: FlexibleItem[];
}

/** Places each flexible task as one block in the free time around `fixedItems`, most urgent first. */
export function schedule(
  range: Interval,
  fixedItems: FixedItem[],
  flexibleItems: FlexibleItem[],
  settings: SchedulerSettings,
): ScheduleResult {
  return placeTasks(flexibleItems, freeTimeMap(range, fixedItems, settings));
}

/**
 * Places each task as one block in `free`, most urgent first.
 * `free` must be sorted by start with gaps between blocks, as `freeTimeMap` returns it.
 */
export function placeTasks(tasks: FlexibleItem[], free: Interval[]): ScheduleResult {
  let remaining = free;
  const placements: Placement[] = [];
  const unplaced: FlexibleItem[] = [];

  for (const task of orderByUrgency(tasks, remaining)) {
    const placed = placeSingleBlock(task, remaining);
    if (placed) {
      placements.push(placed.placement);
      remaining = placed.free;
    } else {
      unplaced.push(task);
    }
  }
  return { placements, unplaced };
}
