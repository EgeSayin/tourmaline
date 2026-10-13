import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FixedItem } from "@/lib/items";
import type { Downtime } from "@/lib/downtime";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { MINUTES_PER_DAY } from "@/lib/time/time-of-day";
import { covers, expectSortedWithGaps, intervalArb, minuteOf, SPAN_MIN } from "../../support/intervals";
import { fixedItemArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

/** Assumes UTC, where generated minutes are already local time, from ORIGIN, a Monday. */
function inDowntime(minute: number, downtime: Downtime): boolean {
  const minuteOfDay = minute % MINUTES_PER_DAY;
  return downtime[Math.floor(minute / MINUTES_PER_DAY) % 7].some(
    (range) => range.startMinute <= minuteOfDay && minuteOfDay < range.endMinute,
  );
}

function inBufferedItem(minute: number, items: FixedItem[]): boolean {
  return items.some(
    (item) =>
      minuteOf(item.start) - item.bufferBeforeMin <= minute && minute < minuteOf(item.end) + item.bufferAfterMin,
  );
}

describe("freeTimeMap", () => {
  it("frees exactly the minutes in range, outside downtime, and outside every buffered item", () => {
    const itemsArb = fc.array(fixedItemArb, { maxLength: 8 });

    fc.assert(
      fc.property(intervalArb(SPAN_MIN), utcSettingsArb, itemsArb, (range, settings, items) => {
        const result = freeTimeMap(range, items, settings);

        expectSortedWithGaps(result);
        for (let minute = 0; minute < SPAN_MIN; minute++) {
          const expected =
            covers([range], minute) && !inDowntime(minute, settings.downtime) && !inBufferedItem(minute, items);
          expect(covers(result, minute)).toBe(expected);
        }
      }),
    );
  });
});
