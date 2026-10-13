import { type DayRange, MINUTES_PER_DAY } from "@/lib/time/time-of-day";

/** The week painter edits a day in steps of this many minutes, and submits it as one "0" or "1" per step. */
export const DAY_STEP_MIN = 30;
export const DAY_STEPS = MINUTES_PER_DAY / DAY_STEP_MIN;

/** One flag per step of the day, set where `ranges` cover the step. */
export function toSteps(ranges: readonly DayRange[]): boolean[] {
  return Array.from({ length: DAY_STEPS }, (_, step) =>
    ranges.some((range) => range.startMinute <= step * DAY_STEP_MIN && step * DAY_STEP_MIN < range.endMinute),
  );
}

export function fromSteps(steps: readonly boolean[]): DayRange[] {
  const ranges: DayRange[] = [];
  steps.forEach((set, step) => {
    if (!set) return;
    const minute = step * DAY_STEP_MIN;
    const last = ranges.at(-1);
    if (last?.endMinute === minute) last.endMinute += DAY_STEP_MIN;
    else ranges.push({ startMinute: minute, endMinute: minute + DAY_STEP_MIN });
  });
  return ranges;
}
