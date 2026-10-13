import { bufferedSpan, type FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import { type Interval, type IntervalSet, subtractIntervals } from "@/lib/time/interval";
import { weeklyIntervals } from "@/server/time/weekly-ranges";

/** Returns the parts of `range` outside downtime and fixed items (including their buffers), sorted by start. */
export function freeTimeMap(range: Interval, fixedItems: FixedItem[], settings: SchedulerSettings): IntervalSet {
  const busy = fixedItems.map(bufferedSpan);
  return subtractIntervals([range], [...weeklyIntervals(range, settings.downtime, settings.timeZone), ...busy]);
}
