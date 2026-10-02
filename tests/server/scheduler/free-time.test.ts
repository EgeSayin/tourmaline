import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FixedItem } from "@/lib/items";
import type { SchedulerSettings } from "@/lib/settings";
import type { DailyWindow } from "@/lib/time-of-day";
import { freeTimeMap } from "@/server/scheduler/free-time";
import type { Interval } from "@/server/scheduler/intervals";
import { covers, expectSortedWithGaps, intervalArb, minuteOf, SPAN_MIN } from "../../support/intervals";
import { fixed } from "../../support/items";

const MINUTES_PER_DAY = 24 * 60;

function utc(start: string, end: string): Interval {
  return { start: new Date(`${start}Z`), end: new Date(`${end}Z`) };
}

const downtimeArb = fc.record({
  startMinute: fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }),
  endMinute: fc.integer({ min: 0, max: MINUTES_PER_DAY - 1 }),
});

const fixedItemArb = fc
  .tuple(intervalArb(), fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 90 }))
  .map(([interval, before, after]) => fixed("Item", interval, before, after));

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
  it("removes downtime and fixed items with their buffers from the range", () => {
    const settings: SchedulerSettings = {
      timeZone: "America/New_York",
      downtime: { startMinute: 23 * 60, endMinute: 10 * 60 },
    };
    // Mon Oct 5 2026, 00:00–24:00 EDT (UTC-4).
    const range = utc("2026-10-05T04:00", "2026-10-06T04:00");
    // Unsorted on purpose: the result must come back sorted regardless.
    const items = [
      fixed("Club", utc("2026-10-05T22:00", "2026-10-05T23:00")), // 18:00–19:00
      fixed("Tomorrow", utc("2026-10-06T15:00", "2026-10-06T16:00")), // outside the range
      fixed("Call", utc("2026-10-06T02:30", "2026-10-06T03:30")), // 22:30–23:30, runs into downtime
      fixed("Lecture", utc("2026-10-05T15:00", "2026-10-05T16:15"), 15), // 11:00–12:15, 15 min buffers
    ];

    expect(freeTimeMap(range, items, settings)).toEqual([
      utc("2026-10-05T14:00", "2026-10-05T14:45"), // 10:00–10:45
      utc("2026-10-05T16:30", "2026-10-05T22:00"), // 12:30–18:00
      utc("2026-10-05T23:00", "2026-10-06T02:30"), // 19:00–22:30
    ]);
  });

  it("frees exactly the minutes in range, outside downtime, and outside every buffered item", { tags: ["property"] }, () => {
    const itemsArb = fc.array(fixedItemArb, { maxLength: 8 });

    fc.assert(
      fc.property(intervalArb(SPAN_MIN), downtimeArb, itemsArb, (range, downtime, items) => {
        // Time zone handling is covered by downtimeIntervals' own tests.
        const result = freeTimeMap(range, items, { timeZone: "UTC", downtime });

        expectSortedWithGaps(result);
        for (let minute = 0; minute < SPAN_MIN; minute++) {
          const expected = covers([range], minute) && !inDowntime(minute, downtime) && !inBufferedItem(minute, items);
          expect(covers(result, minute)).toBe(expected);
        }
      }),
    );
  });
});
