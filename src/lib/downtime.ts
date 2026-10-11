import { type DayRange, MINUTES_PER_DAY } from "@/lib/time/time-of-day";

/**
 * Each weekday's downtime, Monday first: sorted ranges with gaps between them. Downtime past midnight goes on to the
 * next weekday's first range.
 */
export type Downtime = readonly (readonly DayRange[])[];

/** The settings calendar paints downtime in steps of this many minutes. */
export const DOWNTIME_STEP_MIN = 30;
export const DOWNTIME_STEPS = MINUTES_PER_DAY / DOWNTIME_STEP_MIN;

/** The same downtime every night, from `startMinute` to `endMinute` the next morning. */
export function nightly(startMinute: number, endMinute: number): Downtime {
  return Array.from({ length: 7 }, () => [
    { startMinute: 0, endMinute },
    { startMinute, endMinute: MINUTES_PER_DAY },
  ]);
}

/** One flag per step of the day, set where the step is downtime. */
export function toSteps(ranges: readonly DayRange[]): boolean[] {
  return Array.from({ length: DOWNTIME_STEPS }, (_, step) =>
    ranges.some((range) => range.startMinute <= step * DOWNTIME_STEP_MIN && step * DOWNTIME_STEP_MIN < range.endMinute),
  );
}

export function fromSteps(steps: readonly boolean[]): DayRange[] {
  const ranges: DayRange[] = [];
  steps.forEach((down, step) => {
    if (!down) return;
    const minute = step * DOWNTIME_STEP_MIN;
    const last = ranges.at(-1);
    if (last?.endMinute === minute) last.endMinute += DOWNTIME_STEP_MIN;
    else ranges.push({ startMinute: minute, endMinute: minute + DOWNTIME_STEP_MIN });
  });
  return ranges;
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
