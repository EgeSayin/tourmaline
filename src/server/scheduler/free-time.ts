import "server-only";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { downtimeIntervals } from "./downtime";
import { type Interval, subtractIntervals } from "./intervals";

const MS_PER_MINUTE = 60_000;

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(
  range: Interval,
  fixedItems: FixedItem[],
  settings: SchedulerSettings,
): Interval[] {
  const busy = fixedItems.map((item) => ({
    start: new Date(item.start.getTime() - item.bufferBeforeMin * MS_PER_MINUTE),
    end: new Date(item.end.getTime() + item.bufferAfterMin * MS_PER_MINUTE),
  }));
  return subtractIntervals([range], [...downtimeIntervals(range, settings), ...busy]);
}
