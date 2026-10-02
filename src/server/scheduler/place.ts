import "server-only";
import type { FlexibleItem } from "@/lib/items";
import type { Placement } from "@/lib/placements";
import { type Interval, subtractIntervals } from "./intervals";
import { findEarliestSlot } from "./slots";

/**
 * Places the whole task as one block at the earliest fit between its `earliestStart` and `deadline`.
 * Returns the placement and the remaining free time, or `null` if it doesn't fit.
 * `free` must be sorted by start with gaps between blocks, as `freeTimeMap` returns it.
 */
export function placeSingleBlock(
  task: FlexibleItem,
  free: Interval[],
): { placement: Placement; free: Interval[] } | null {
  const slot = findEarliestSlot(free, task.durationMin, { start: task.earliestStart, end: task.deadline });
  if (!slot) return null;

  return {
    placement: { itemId: task.id, ...slot, source: "auto", pinned: false },
    free: subtractIntervals(free, [slot]),
  };
}
