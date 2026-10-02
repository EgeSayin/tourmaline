import "server-only";
import { addMinutes } from "@/lib/duration";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { downtimeIntervals } from "./downtime";
import { type Interval, subtractIntervals } from "./intervals";

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(range: Interval, fixedItems: FixedItem[], settings: SchedulerSettings): Interval[] {
  const busy = fixedItems.map((item) => ({
    start: addMinutes(item.start, -item.bufferBeforeMin),
    end: addMinutes(item.end, item.bufferAfterMin),
  }));
  return subtractIntervals([range], [...downtimeIntervals(range, settings), ...busy]);
}
