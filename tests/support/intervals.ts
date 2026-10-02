import fc from "fast-check";
import { expect } from "vitest";
import type { Interval } from "@/server/scheduler/intervals";

/** Midnight UTC; generated times are whole minutes in [ORIGIN, ORIGIN + SPAN_MIN). */
export const ORIGIN = Date.UTC(2026, 9, 5);
export const SPAN_MIN = 2 * 24 * 60;

export const utc = (start: string, end: string): Interval => ({
  start: new Date(`${start}Z`),
  end: new Date(`${end}Z`),
});

/** Times of day on ORIGIN's date, e.g. `iv("10:00", "11:30")`. */
export const iv = (start: string, end: string) => utc(`2026-10-05T${start}`, `2026-10-05T${end}`);

export const at = (minute: number) => new Date(ORIGIN + minute * 60_000);
export const minuteOf = (date: Date) => (date.getTime() - ORIGIN) / 60_000;

export function intervalArb(maxLengthMin = 6 * 60): fc.Arbitrary<Interval> {
  return fc
    .tuple(fc.integer({ min: 0, max: SPAN_MIN - 1 }), fc.integer({ min: 1, max: maxLengthMin }))
    .map(([start, length]) => ({ start: at(start), end: at(Math.min(start + length, SPAN_MIN)) }));
}

export const intervalsArb = fc.array(intervalArb(), { maxLength: 12 });

export function covers(intervals: Interval[], minute: number): boolean {
  return intervals.some((i) => minuteOf(i.start) <= minute && minute < minuteOf(i.end));
}

export function expectSortedWithGaps(intervals: Interval[]) {
  for (const [i, interval] of intervals.entries()) {
    expect(interval.start < interval.end).toBe(true);
    if (i > 0) expect(intervals[i - 1].end < interval.start).toBe(true);
  }
}
