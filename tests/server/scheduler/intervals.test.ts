import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Interval, mergeIntervals, subtractIntervals } from "@/server/scheduler/intervals";

function iv(start: string, end: string): Interval {
  return {
    start: new Date(`2026-10-05T${start}:00Z`),
    end: new Date(`2026-10-05T${end}:00Z`),
  };
}

const ORIGIN = Date.UTC(2026, 9, 5);
const SPAN_MIN = 24 * 60;

const at = (minute: number) => new Date(ORIGIN + minute * 60_000);
const minuteOf = (date: Date) => (date.getTime() - ORIGIN) / 60_000;

// Whole-minute bounds, so checking every minute in the span checks coverage completely.
const intervalArb = fc
  .tuple(fc.integer({ min: 0, max: SPAN_MIN - 1 }), fc.integer({ min: 1, max: 6 * 60 }))
  .map(([start, length]): Interval => ({ start: at(start), end: at(Math.min(start + length, SPAN_MIN)) }));
const intervalsArb = fc.array(intervalArb, { maxLength: 12 });

function covers(intervals: Interval[], minute: number): boolean {
  return intervals.some((i) => minuteOf(i.start) <= minute && minute < minuteOf(i.end));
}

function expectSortedWithGaps(intervals: Interval[]) {
  for (const [i, interval] of intervals.entries()) {
    expect(interval.start < interval.end).toBe(true);
    if (i > 0) expect(intervals[i - 1].end < interval.start).toBe(true);
  }
}

describe("mergeIntervals", { tags: ["unit", "critical"] }, () => {
  it("sorts busy blocks and merges overlapping, touching, and nested ones", () => {
    const busy = [
      iv("16:00", "17:00"),
      iv("10:00", "11:30"),
      iv("11:00", "12:00"), // overlaps previous
      iv("12:00", "12:45"), // touches previous
      iv("14:00", "18:00"),
      iv("15:00", "15:30"), // nested in previous
    ];
    const snapshot = structuredClone(busy);

    expect(mergeIntervals(busy)).toEqual([iv("10:00", "12:45"), iv("14:00", "18:00")]);
    expect(busy).toEqual(snapshot);
    expect(mergeIntervals([])).toEqual([]);
  });

  it("covers exactly the input's minutes, sorted with gaps, without mutating input", { tags: ["property"] }, () => {
    fc.assert(
      fc.property(intervalsArb, (input) => {
        const snapshot = structuredClone(input);
        const merged = mergeIntervals(input);

        expectSortedWithGaps(merged);
        for (let minute = 0; minute < SPAN_MIN; minute++) {
          expect(covers(merged, minute)).toBe(covers(input, minute));
        }
        expect(input).toEqual(snapshot);
      }),
    );
  });
});

describe("subtractIntervals", { tags: ["unit", "critical"] }, () => {
  it("removes busy blocks from free time, splitting and trimming as needed", () => {
    const free = [iv("14:00", "20:00"), iv("10:00", "12:00")];
    const busy = [
      iv("09:00", "10:30"), // trims the start of a free slot
      iv("13:00", "13:30"), // between free slots, no effect
      iv("15:00", "16:00"), // splits a free slot
      iv("15:30", "17:00"), // overlaps the previous busy block
      iv("19:00", "21:00"), // trims the end of a free slot
    ];

    expect(subtractIntervals(free, busy)).toEqual([
      iv("10:30", "12:00"),
      iv("14:00", "15:00"),
      iv("17:00", "19:00"),
    ]);
    expect(subtractIntervals(free, [])).toEqual([iv("10:00", "12:00"), iv("14:00", "20:00")]);
    expect(subtractIntervals(free, [iv("08:00", "22:00")])).toEqual([]);
  });

  it("covers exactly the free minutes not busy, sorted with gaps", { tags: ["property"] }, () => {
    fc.assert(
      fc.property(intervalsArb, intervalsArb, (free, busy) => {
        const result = subtractIntervals(free, busy);

        expectSortedWithGaps(result);
        for (let minute = 0; minute < SPAN_MIN; minute++) {
          expect(covers(result, minute)).toBe(covers(free, minute) && !covers(busy, minute));
        }
      }),
    );
  });
});
