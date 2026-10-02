import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FixedItem } from "@/lib/items";
import type { DailyWindow } from "@/lib/time-of-day";
import { freeTimeMap } from "@/server/scheduler/free-time";
import { covers, expectSortedWithGaps, intervalArb, minuteOf, SPAN_MIN } from "../../support/intervals";
import { fixedItemArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

const MINUTES_PER_DAY = 24 * 60;

/** Assumes UTC, where generated minutes are already local time. */
function inDowntime(minute: number, { startMinute, endMinute }: DailyWindow): boolean {
  const minuteOfDay = minute % MINUTES_PER_DAY;
  if (startMinute <= endMinute) return startMinute <= minuteOfDay && minuteOfDay < endMinute;
  return minuteOfDay >= startMinute || minuteOfDay < endMinute;
}

function inBufferedItem(minute: number, items: FixedItem[]): boolean {
  return items.some(
    (item) => minuteOf(item.start) - item.bufferBeforeMin <= minute && minute < minuteOf(item.end) + item.bufferAfterMin,
  );
}

describe("freeTimeMap", { tags: ["unit", "critical"] }, () => {
  it("frees exactly the minutes in range, outside downtime, and outside every buffered item", { tags: ["property"] }, () => {
    const itemsArb = fc.array(fixedItemArb, { maxLength: 8 });

    fc.assert(
      fc.property(intervalArb(SPAN_MIN), utcSettingsArb, itemsArb, (range, settings, items) => {
        const result = freeTimeMap(range, items, settings);

        expectSortedWithGaps(result);
        for (let minute = 0; minute < SPAN_MIN; minute++) {
          const expected = covers([range], minute) && !inDowntime(minute, settings.downtime) && !inBufferedItem(minute, items);
          expect(covers(result, minute)).toBe(expected);
        }
      }),
    );
  });
});
