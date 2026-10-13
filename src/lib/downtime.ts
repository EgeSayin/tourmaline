import { type DayRange, MINUTES_PER_DAY, type WeeklyRanges } from "@/lib/time/time-of-day";

/** When tasks are never planned, each weekday. */
export type Downtime = WeeklyRanges;

/** The same downtime every night, from `startMinute` to `endMinute` the next morning. */
export function nightly(startMinute: number, endMinute: number): Downtime {
  return Array.from({ length: 7 }, () => [
    { startMinute: 0, endMinute },
    { startMinute, endMinute: MINUTES_PER_DAY },
  ]);
}

/**
 * The part of the day a calendar shows: all of it but the downtime every weekday has from midnight on and up to
 * midnight. A grid can't leave out the middle of a day, so downtime there stays shown.
 */
export function shownMinutes(downtime: Downtime): DayRange {
  const startMinute = Math.min(...downtime.map(([first]) => (first?.startMinute === 0 ? first.endMinute : 0)));
  const endMinute = Math.max(
    ...downtime.map((ranges) => {
      const last = ranges.at(-1);
      return last?.endMinute === MINUTES_PER_DAY ? last.startMinute : MINUTES_PER_DAY;
    }),
  );
  return startMinute < endMinute ? { startMinute, endMinute } : { startMinute: 0, endMinute: MINUTES_PER_DAY };
}
