import "server-only";
import { addMinutes, minutesBetween } from "@/lib/duration";
import type { Interval } from "./intervals";

/**
 * Returns the earliest `durationMin`-long block inside both a `free` interval and `window`,
 * or `null` if none fits. `free` must be sorted by start.
 */
export function findEarliestSlot(
  free: Interval[],
  durationMin: number,
  window: Interval,
): Interval | null {
  for (const slot of free) {
    const start = slot.start > window.start ? slot.start : window.start;
    const end = slot.end < window.end ? slot.end : window.end;
    if (minutesBetween(start, end) >= durationMin) {
      return { start, end: addMinutes(start, durationMin) };
    }
  }
  return null;
}
