import "server-only";
import { type Item, itemSpan } from "@/lib/items";
import type { Interval } from "@/lib/time/interval";

/** The span to plan: from `now` to the latest fixed item end or task deadline, or empty if none is after `now`. */
export function planningHorizon(now: Date, items: Item[]): Interval {
  let end = now;
  for (const item of items) {
    const last = itemSpan(item).end;
    if (last > end) end = last;
  }
  return { start: now, end };
}
