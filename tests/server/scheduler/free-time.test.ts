import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FixedItem } from "@/lib/items";
import { type Downtime, nightly } from "@/lib/downtime";
import { downtimeIntervals, freeTimeMap } from "@/server/scheduler/free-time";
import { covers, expectSortedWithGaps, intervalArb, minuteOf, SPAN_MIN, utc } from "../../support/intervals";
import { fixedItemArb } from "../../support/items";
import { utcSettingsArb } from "../../support/settings";

const MINUTES_PER_DAY = 24 * 60;

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

describe("downtimeIntervals", () => {
  it("returns each weekday's local ranges as exact times, joined across midnight and DST changes, clipped to the range", () => {
    const overnight = nightly(23 * 60, 10 * 60);
    const timeZone = "America/New_York";
    // Sat Oct 31 08:00 EDT → Mon Nov 2 00:00 EST. Clocks go back at 02:00 on Sun Nov 1.
    const range = utc("2026-10-31T12:00", "2026-11-02T05:00");

    expect(downtimeIntervals(range, overnight, timeZone)).toEqual([
      utc("2026-10-31T12:00", "2026-10-31T14:00"), // Fri night's window, clipped to range start
      utc("2026-11-01T03:00", "2026-11-01T15:00"), // Sat night: 23:00 EDT → 10:00 EST, 12 real hours
      utc("2026-11-02T04:00", "2026-11-02T05:00"), // Sun night, clipped to range end
    ]);

    // Sat Mar 13 2027 12:00 EST → Sun Mar 14 12:00 EDT. Clocks jump from 02:00 to 03:00 on Sun.
    expect(downtimeIntervals(utc("2027-03-13T17:00", "2027-03-14T16:00"), overnight, timeZone)).toEqual([
      utc("2027-03-14T04:00", "2027-03-14T14:00"), // 23:00 EST → 10:00 EDT, 10 real hours
    ]);
  });
});
