import { type Item, itemSpan } from "@/lib/items";
import { type Interval, later } from "@/lib/time/interval";

/** The span to plan: from `now` to the latest fixed item end or task deadline, or empty if none is after `now`. */
export function planningHorizon(now: Date, items: Item[]): Interval {
  return { start: now, end: items.reduce((end, item) => later(end, itemSpan(item).end), now) };
}
