import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Interval, mergeIntervals } from "@/server/scheduler/intervals";
import { findEarliestSlot } from "@/server/scheduler/slots";
import { at, covers, intervalArb, intervalsArb, SPAN_MIN } from "../../support/intervals";

function iv(start: string, end: string): Interval {
  return {
    start: new Date(`2026-10-05T${start}:00Z`),
    end: new Date(`2026-10-05T${end}:00Z`),
  };
}

/** Earliest minute starting `durationMin` consecutive minutes inside both `free` and `window`. */
function earliestFittingMinute(free: Interval[], window: Interval, durationMin: number): number | null {
  const run = new Array<number>(SPAN_MIN + 1).fill(0);
  for (let minute = SPAN_MIN - 1; minute >= 0; minute--) {
    run[minute] = covers(free, minute) && covers([window], minute) ? run[minute + 1] + 1 : 0;
  }
  const start = run.findIndex((length) => length >= durationMin);
  return start === -1 ? null : start;
}

describe("findEarliestSlot", { tags: ["unit", "critical"] }, () => {
  it("returns the earliest free block that fits the duration inside the window", () => {
    const free = [iv("10:00", "10:45"), iv("12:30", "18:00"), iv("19:00", "22:30")];
    const day = iv("00:00", "23:59");

    expect(findEarliestSlot(free, 30, day)).toEqual(iv("10:00", "10:30"));
    expect(findEarliestSlot(free, 60, day)).toEqual(iv("12:30", "13:30")); // first slot too short
    expect(findEarliestSlot(free, 45, iv("00:00", "10:45"))).toEqual(iv("10:00", "10:45")); // ends exactly at deadline
    expect(findEarliestSlot(free, 60, iv("13:00", "23:59"))).toEqual(iv("13:00", "14:00")); // starts mid-slot
    expect(findEarliestSlot(free, 60, iv("00:00", "13:15"))).toBeNull(); // deadline cuts the slot short
    expect(findEarliestSlot(free, 6 * 60, day)).toBeNull(); // longer than any free block
  });

  it("returns a slot at the earliest minute that fits, or null when none does", { tags: ["property"] }, () => {
    const freeArb = intervalsArb.map(mergeIntervals);
    const durationArb = fc.integer({ min: 1, max: 8 * 60 });

    fc.assert(
      fc.property(freeArb, intervalArb(SPAN_MIN), durationArb, (free, window, durationMin) => {
        const start = earliestFittingMinute(free, window, durationMin);
        const expected = start === null ? null : { start: at(start), end: at(start + durationMin) };

        expect(findEarliestSlot(free, durationMin, window)).toEqual(expected);
      }),
    );
  });
});
