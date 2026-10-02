import "server-only";
import { addMinutes, minutesBetween } from "@/lib/duration";
import { SLOT_MIN } from "@/lib/placements";
import type { Interval } from "./intervals";

const SLOT_MS = SLOT_MIN * 60_000;

/**
 * Returns the earliest `durationMin`-long block inside both a `free` interval and `window`, starting on the
 * `SLOT_MIN` grid, or `null` if none fits. `free` must be sorted by start with gaps between blocks, as
 * `freeTimeMap` returns it.
 */
export function findEarliestSlot(free: Interval[], durationMin: number, window: Interval): Interval | null {
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
