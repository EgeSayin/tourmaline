import "server-only";
import type { Item } from "@/lib/items";
import type { Interval } from "./intervals";

/** The span to plan: from `now` to the latest fixed item end or task deadline, or empty if none is after `now`. */
export function planningHorizon(now: Date, items: Item[]): Interval {
  let end = now;
  for (const item of items) {
    const last = item.timing === "fixed" ? item.end : item.deadline;
    if (last > end) end = last;
  }
  return { start: now, end };
}
